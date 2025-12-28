import { select, input, password } from '@inquirer/prompts';
import Conf from 'conf';
import keytar from 'keytar';

const SERVICE_NAME = 'intentmail';

interface IntentMailConfig {
  aiProvider: 'auto' | 'vertex' | 'openai' | 'anthropic' | 'ollama' | 'groq' | 'cerebras' | 'none';
  gcpProject?: string;
  gcpLocation?: string;
  ollamaHost?: string;
  emailAccount?: string;
}

const config = new Conf<IntentMailConfig>({
  projectName: 'intentmail',
  defaults: {
    aiProvider: 'none',
  },
});

async function setSecureCredential(key: string, value: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, value);
}

export async function getSecureCredential(key: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, key);
}

export async function runConfigCommand(): Promise<void> {
  console.log('\n  IntentMail Configuration\n');

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
      await setSecureCredential('groq-api-key', groqApiKey);
      console.log('  Groq API key stored securely');
    }

    // Prompt for Cerebras API key
    console.log('\n  Cerebras: Get FREE API key at https://inference.cerebras.ai');
    const existingCerebrasKey = await getSecureCredential('cerebras-api-key');
    const cerebrasKeyPrompt = existingCerebrasKey ? ' (leave empty to keep existing)' : '';
    const cerebrasApiKey = await password({
      message: `Cerebras API Key${cerebrasKeyPrompt}:`,
    });
    if (cerebrasApiKey) {
      await setSecureCredential('cerebras-api-key', cerebrasApiKey);
      console.log('  Cerebras API key stored securely');
    }

    console.log('\n  Ollama (local fallback) will be used automatically if installed.');
    console.log('  Install Ollama: curl -fsSL https://ollama.ai/install.sh | sh\n');
  }

  if (aiProvider === 'vertex') {
    updates.gcpProject = await input({
      message: 'GCP Project ID:',
      default: config.get('gcpProject') ?? '',
    });
    updates.gcpLocation = await input({
      message: 'GCP Location:',
      default: config.get('gcpLocation') ?? 'us-central1',
    });
  }

  if (aiProvider === 'openai') {
    const existingKey = await getSecureCredential('openai-api-key');
    const keyPrompt = existingKey ? ' (leave empty to keep existing)' : '';
    const apiKey = await password({
      message: `OpenAI API Key${keyPrompt}:`,
    });
    if (apiKey) {
      await setSecureCredential('openai-api-key', apiKey);
      console.log('  API key stored securely in system keychain');
    }
  }

  if (aiProvider === 'anthropic') {
    const existingKey = await getSecureCredential('anthropic-api-key');
    const keyPrompt = existingKey ? ' (leave empty to keep existing)' : '';
    const apiKey = await password({
      message: `Anthropic API Key${keyPrompt}:`,
    });
    if (apiKey) {
      await setSecureCredential('anthropic-api-key', apiKey);
      console.log('  API key stored securely in system keychain');
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
      await setSecureCredential('groq-api-key', apiKey);
      console.log('  API key stored securely in system keychain');
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
      await setSecureCredential('cerebras-api-key', apiKey);
      console.log('  API key stored securely in system keychain');
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

  console.log('\n  Configuration saved to:', config.path);
  console.log('  API keys stored securely in system keychain');
  console.log('  Run `intentmail` to start the TUI.\n');
}
