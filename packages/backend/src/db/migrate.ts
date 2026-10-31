import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runner, type RunnerOption } from 'node-pg-migrate';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface MigrateOptions {
  databaseUrl: string;
  direction?: 'up' | 'down';
  count?: number;
  migrationsTable?: string;
  verbose?: boolean;
}

/**
 * Runs database migrations using node-pg-migrate.
 * Can be used programmatically (tests, scripts) or via CLI.
 */
export async function runMigrations(options: MigrateOptions): Promise<void> {
  const {
    databaseUrl,
    direction = 'up',
    count,
    migrationsTable = 'pgmigrations',
    verbose = false,
  } = options;

  const migrationsDir = resolve(__dirname, '../../migrations');

  const runnerOptions: RunnerOption = {
    databaseUrl,
    dir: migrationsDir,
    direction,
    count,
    migrationsTable,
    schema: 'public',
    createSchema: true,
    createMigrationsSchema: true,
    verbose,
    log: verbose ? console.log : () => {},
  };

  await runner(runnerOptions);
}

/**
 * CLI entrypoint: Run migrations using DB_URL from environment
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DB_URL;

  if (!databaseUrl) {
    console.error('❌ DB_URL environment variable is required');
    process.exit(1);
  }

  const direction = (process.argv[2] as 'up' | 'down') || 'up';
  const count = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

  console.log(`🔄 Running migrations ${direction}${count ? ` (${count})` : ''}...`);

  try {
    await runMigrations({
      databaseUrl,
      direction,
      count,
      verbose: true,
    });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = process.argv[1]?.includes('migrate');
if (isMainModule) {
  main();
}
