import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '../../package.json');

interface PackageJson {
  version: string;
  description: string;
}

function getPackageInfo(): PackageJson {
  try {
    const content = readFileSync(packageJsonPath, 'utf8');
    return JSON.parse(content) as PackageJson;
  } catch (error) {
    console.error(`Warning: Could not read package.json at ${packageJsonPath}:`, error);
    return { version: '0.0.0', description: 'IntentMail CLI' };
  }
}

const pkg = getPackageInfo();

const program = new Command()
  .name('intentmail')
  .description(pkg.description)
  .version(pkg.version);

program
  .command('inbox', { isDefault: true })
  .description('Open inbox TUI (default command)')
  .action(async () => {
    const { runInboxCommand } = await import('./commands/inbox.js');
    await runInboxCommand();
  });

program
  .command('compose')
  .description('Compose a new email')
  .option('--ai', 'Use AI to help draft the email')
  .action(async (options: { ai?: boolean }) => {
    const { runComposeCommand } = await import('./commands/compose.js');
    await runComposeCommand(options);
  });

program
  .command('search <query>')
  .description('Search emails with AI-powered semantic search')
  .action(async (query: string) => {
    const { runSearchCommand } = await import('./commands/search.js');
    await runSearchCommand(query);
  });

program
  .command('config')
  .description('Configure IntentMail (AI provider, email accounts)')
  .action(async () => {
    const { runConfigCommand } = await import('./commands/config.js');
    await runConfigCommand();
  });

program
  .command('serve')
  .description('Run as MCP server (for Claude Desktop integration)')
  .action(async () => {
    const { runServer } = await import('../index.js');
    runServer();
  });

program
  .command('serve-web')
  .description('Run the local web API server (backs the web dashboard)')
  .option('-p, --port <port>', 'Port to listen on (default 4787)')
  .action(async (options: { port?: string }) => {
    const { startApiServer } = await import('../web/server/api-server.js');
    await startApiServer({ port: options.port ? Number(options.port) : undefined });
  });

program.parse();
