import { select, input, password } from '@inquirer/prompts';
import Conf from 'conf';

const SERVICE_NAME = 'intentmail';

// Keytar is optional - falls back to Google Secret Manager if not available
let keytar: typeof import('keytar') | null = null;
try {
  keytar = await import('keytar');
} catch {
  // libsecret not installed - will use Google Secret Manager
}

// Google Secret Manager client (lazy loaded)
let secretManagerClient: any = null;

interface IntentMailConfig {
  aiProvider: 'auto' | 'vertex' | 'openai' | 'anthropic' | 'ollama' | 'groq' | 'cerebras' | 'none';
  gcpProject?: string;
  gcpLocation?: string;
  ollamaHost?: string;
  emailAccount?: string;
  useSecretManager?: boolean;
}

const config = new Conf<IntentMailConfig>({
  projectName: 'intentmail',
  defaults: {
    aiProvider: 'none',
  },
});

/**
 * Get Google Secret Manager client (lazy initialization)
 */
async function getSecretManagerClient(): Promise<any> {
  if (secretManagerClient) return secretManagerClient;

  try {
    const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
    secretManagerClient = new SecretManagerServiceClient();
    return secretManagerClient;
  } catch {
    return null;
  }
}

/**
 * Get GCP project ID from config or environment
 */
function getGcpProject(): string | null {
  return config.get('gcpProject') || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || null;
}

/**
 * Store credential in Google Secret Manager
 */
async function setSecretManagerCredential(key: string, value: string): Promise<boolean> {
  const client = await getSecretManagerClient();
  const project = getGcpProject();

  if (!client || !project) {
    return false;
  }

  const secretId = `intentmail-${key}`;
  const parent = `projects/${project}`;

  try {
    // Try to create the secret first
    try {
      await client.createSecret({
        parent,
        secretId,
        secret: {
          replication: { automatic: {} },
        },
      });
    } catch (err: any) {
      // Secret already exists - that's fine
      if (err.code !== 6) throw err; // 6 = ALREADY_EXISTS
    }

    // Add the secret version
    await client.addSecretVersion({
      parent: `${parent}/secrets/${secretId}`,
      payload: {
        data: Buffer.from(value, 'utf8'),
      },
    });

    return true;
  } catch (err) {
    console.error('  Failed to store in Secret Manager:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Get credential from Google Secret Manager
 */
async function getSecretManagerCredential(key: string): Promise<string | null> {
  const client = await getSecretManagerClient();
  const project = getGcpProject();

  if (!client || !project) {
    return null;
  }

  const secretId = `intentmail-${key}`;

  try {
    const [version] = await client.accessSecretVersion({
      name: `projects/${project}/secrets/${secretId}/versions/latest`,
    });

    const payload = version.payload?.data;
    if (payload) {
      return typeof payload === 'string' ? payload : payload.toString('utf8');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Store credential securely
 * Priority: keytar (system keychain) > Google Secret Manager
 */
async function setSecureCredential(key: string, value: string): Promise<void> {
  // Try keytar first (system keychain)
  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, key, value);
    return;
  }

  // Fall back to Google Secret Manager
  const stored = await setSecretManagerCredential(key, value);
  if (stored) {
    config.set('useSecretManager', true);
    return;
  }

  // No secure storage available - refuse to store insecurely
  throw new Error(
    'No secure credential storage available.\n\n' +
    'Please either:\n' +
    '  1. Install libsecret: sudo apt install libsecret-1-dev && npm rebuild keytar\n' +
    '  2. Configure GCP project: intentmail config (set Vertex AI project)\n' +
    '     Then ensure you have Secret Manager API enabled and proper IAM permissions.\n\n' +
    'IntentMail refuses to store credentials in plaintext for security.'
  );
}

/**
 * Get credential from secure storage
 * Priority: keytar (system keychain) > Google Secret Manager
 */
export async function getSecureCredential(key: string): Promise<string | null> {
  // Try keytar first
  if (keytar) {
    return keytar.getPassword(SERVICE_NAME, key);
  }

  // Fall back to Secret Manager
  return getSecretManagerCredential(key);
}

/**
 * Check if secure storage is available
 */
async function checkSecureStorageAvailable(): Promise<{ method: string; available: boolean }> {
  if (keytar) {
    return { method: 'system keychain (keytar)', available: true };
  }

  const client = await getSecretManagerClient();
  const project = getGcpProject();

  if (client && project) {
    return { method: `Google Secret Manager (${project})`, available: true };
  }

  return { method: 'none', available: false };
}

export async function runConfigCommand(): Promise<void> {
  console.log('\n  IntentMail Configuration\n');

  // Check secure storage availability
  const storage = await checkSecureStorageAvailable();
  if (storage.available) {
    console.log(`  Secure storage: ${storage.method}\n`);
  } else {
    console.log('  WARNING: No secure credential storage available.');
    console.log('  Install libsecret or configure GCP project for Secret Manager.\n');
  }

  const aiProvider = await select({
    message: 'Choose AI provider:',
    default: config.get('aiProvider'),
    choices: [
      { name: 'Auto (RECOMMENDED - Free providers with fallback)', value: 'auto' as const },
      { name: 'Groq (FREE - Fastest, 14K req/day)', value: 'groq' as const },
      { name: 'Cerebras (FREE - 1M tokens/day, 3000 t/s)', value: 'cerebras' as const },
      { name: 'Ollama (FREE - Local, Offline)', value: 'ollama' as const },
      { name: 'Vertex AI (Google Cloud)', value: 'vertex' as const },
      { name: 'OpenAI', value: 'openai' as const },
      { name: 'Anthropic (Claude)', value: 'anthropic' as const },
      { name: 'None (Manual only)', value: 'none' as const },
    ],
  });

  const updates: Partial<IntentMailConfig> = { aiProvider };

  // If using Vertex AI or no secure storage, prompt for GCP project first
  if (aiProvider === 'vertex' || !storage.available) {
    updates.gcpProject = await input({
      message: 'GCP Project ID (required for Secret Manager):',
      default: config.get('gcpProject') ?? '',
    });
    if (updates.gcpProject) {
      config.set('gcpProject', updates.gcpProject);
    }

    if (aiProvider === 'vertex') {
      updates.gcpLocation = await input({
        message: 'GCP Location:',
        default: config.get('gcpLocation') ?? 'us-central1',
      });
    }
  }

  if (aiProvider === 'auto') {
    console.log('\n  Auto mode uses multiple FREE providers with automatic fallback:');
    console.log('  1. Groq (primary) - 14,400 req/day, fastest');
    console.log('  2. Cerebras (fallback) - 1M tokens/day');
    console.log('  3. Ollama (offline) - unlimited local\n');
    console.log('  Configure at least one provider (Groq recommended):\n');

    // Prompt for Groq API key
    console.log('  Groq: Get FREE API key at https://console.groq.com');
    const existingGroqKey = await getSecureCredential('groq-api-key');
    const groqKeyPrompt = existingGroqKey ? ' (leave empty to keep existing)' : '';
    const groqApiKey = await password({
      message: `Groq API Key${groqKeyPrompt}:`,
    });
    if (groqApiKey) {
      try {
        await setSecureCredential('groq-api-key', groqApiKey);
        console.log('  Groq API key stored securely');
      } catch (err) {
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }
    }

    // Prompt for Cerebras API key
    console.log('\n  Cerebras: Get FREE API key at https://inference.cerebras.ai');
    const existingCerebrasKey = await getSecureCredential('cerebras-api-key');
    const cerebrasKeyPrompt = existingCerebrasKey ? ' (leave empty to keep existing)' : '';
    const cerebrasApiKey = await password({
      message: `Cerebras API Key${cerebrasKeyPrompt}:`,
    });
    if (cerebrasApiKey) {
      try {
        await setSecureCredential('cerebras-api-key', cerebrasApiKey);
        console.log('  Cerebras API key stored securely');
      } catch (err) {
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log('\n  Ollama (local fallback) will be used automatically if installed.');
    console.log('  Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh\n');
  }

  if (aiProvider === 'openai') {
    const existingKey = await getSecureCredential('openai-api-key');
    const keyPrompt = existingKey ? ' (leave empty to keep existing)' : '';
    const apiKey = await password({
      message: `OpenAI API Key${keyPrompt}:`,
    });
    if (apiKey) {
      try {
        await setSecureCredential('openai-api-key', apiKey);
        console.log('  API key stored securely');
      } catch (err) {
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  if (aiProvider === 'anthropic') {
    const existingKey = await getSecureCredential('anthropic-api-key');
    const keyPrompt = existingKey ? ' (leave empty to keep existing)' : '';
    const apiKey = await password({
      message: `Anthropic API Key${keyPrompt}:`,
    });
    if (apiKey) {
      try {
        await setSecureCredential('anthropic-api-key', apiKey);
        console.log('  API key stored securely');
      } catch (err) {
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  if (aiProvider === 'groq') {
    console.log('\n  Get your FREE Groq API key at: https://console.groq.com');
    console.log('  No credit card required. 14,400 requests/day free.\n');
    const existingKey = await getSecureCredential('groq-api-key');
    const keyPrompt = existingKey ? ' (leave empty to keep existing)' : '';
    const apiKey = await password({
      message: `Groq API Key${keyPrompt}:`,
    });
    if (apiKey) {
      try {
        await setSecureCredential('groq-api-key', apiKey);
        console.log('  API key stored securely');
      } catch (err) {
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  if (aiProvider === 'cerebras') {
    console.log('\n  Get your FREE Cerebras API key at: https://inference.cerebras.ai');
    console.log('  No credit card required. 1,000,000 tokens/day free.\n');
    const existingKey = await getSecureCredential('cerebras-api-key');
    const keyPrompt = existingKey ? ' (leave empty to keep existing)' : '';
    const apiKey = await password({
      message: `Cerebras API Key${keyPrompt}:`,
    });
    if (apiKey) {
      try {
        await setSecureCredential('cerebras-api-key', apiKey);
        console.log('  API key stored securely');
      } catch (err) {
        console.error(`  ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  if (aiProvider === 'ollama') {
    updates.ollamaHost = await input({
      message: 'Ollama Host:',
      default: config.get('ollamaHost') ?? 'http://localhost:11434',
    });
  }

  updates.emailAccount = await input({
    message: 'Email account (e.g., user@gmail.com):',
    default: config.get('emailAccount') ?? '',
  });

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      config.set(key as keyof IntentMailConfig, value);
    }
  }

  // Final storage status
  const finalStorage = await checkSecureStorageAvailable();
  console.log('\n  Configuration saved to:', config.path);
  if (finalStorage.available) {
    console.log(`  API keys stored securely via: ${finalStorage.method}`);
  }
  console.log('  Run `intentmail` to start the TUI.\n');
}
