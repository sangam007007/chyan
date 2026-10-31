import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { runMigrations } from './migrate.js';

describe('Database Migrations', () => {
  let container: StartedPostgreSqlContainer;
  let databaseUrl: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withStartupTimeout(120_000)
      .start();
    databaseUrl = container.getConnectionUri();
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('should run all migrations successfully', async () => {
    await expect(
      runMigrations({ databaseUrl, direction: 'up', verbose: false })
    ).resolves.not.toThrow();
  }, 30_000);

  it('should create exams table with correct columns', async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'exams'
        ORDER BY ordinal_position;
      `);

      const columns = result.rows.map((r) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('name_en');
      expect(columns).toContain('name_hi');
      expect(columns).toContain('description_en');
      expect(columns).toContain('description_hi');
      expect(columns).toContain('category');
      expect(columns).toContain('state');
      expect(columns).toContain('icon_url');
      expect(columns).toContain('is_active');
      expect(columns).toContain('display_order');
      expect(columns).toContain('created_at');
    } finally {
      await client.end();
    }
  });

  it('should create users table with correct columns and foreign key', async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
      `);

      const columns = result.rows.map((r) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('phone');
      expect(columns).toContain('email');
      expect(columns).toContain('full_name');
      expect(columns).toContain('avatar_url');
      expect(columns).toContain('preferred_language');
      expect(columns).toContain('selected_exam_id');
      expect(columns).toContain('google_id');
      expect(columns).toContain('google_avatar_url');
      expect(columns).toContain('onboarding_completed');
      expect(columns).toContain('exam_change_count_this_month');
      expect(columns).toContain('exam_change_month');
      expect(columns).toContain('deletion_scheduled_at');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');

      // Verify foreign key to exams
      const fkResult = await client.query(`
        SELECT tc.constraint_name, ccu.table_name AS foreign_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'users'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'exams';
      `);
      expect(fkResult.rows.length).toBeGreaterThan(0);
    } finally {
      await client.end();
    }
  });

  it('should create sessions table with indexes', async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const result = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'sessions'
        ORDER BY ordinal_position;
      `);

      const columns = result.rows.map((r) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('refresh_token_hash');
      expect(columns).toContain('token_family');
      expect(columns).toContain('device_type');
      expect(columns).toContain('device_info');
      expect(columns).toContain('ip_address');
      expect(columns).toContain('city');
      expect(columns).toContain('is_active');
      expect(columns).toContain('last_active_at');
      expect(columns).toContain('created_at');
      expect(columns).toContain('expires_at');

      // Verify indexes exist
      const indexResult = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'sessions';
      `);
      const indexNames = indexResult.rows.map((r) => r.indexname);
      expect(indexNames).toContain('idx_sessions_user_active');
      expect(indexNames).toContain('idx_sessions_token_family');
      expect(indexNames).toContain('idx_sessions_expires');
    } finally {
      await client.end();
    }
  });

  it('should create account_links table', async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const result = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'account_links'
        ORDER BY ordinal_position;
      `);

      const columns = result.rows.map((r) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('primary_user_id');
      expect(columns).toContain('linked_provider');
      expect(columns).toContain('linked_identifier');
      expect(columns).toContain('linked_at');
    } finally {
      await client.end();
    }
  });

  it('should create auth_audit_log table with indexes', async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const result = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'auth_audit_log'
        ORDER BY ordinal_position;
      `);

      const columns = result.rows.map((r) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('action');
      expect(columns).toContain('ip_address');
      expect(columns).toContain('metadata');
      expect(columns).toContain('created_at');

      // Verify indexes
      const indexResult = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'auth_audit_log';
      `);
      const indexNames = indexResult.rows.map((r) => r.indexname);
      expect(indexNames).toContain('idx_audit_user');
      expect(indexNames).toContain('idx_audit_action');
    } finally {
      await client.end();
    }
  });

  it('should seed exam data with correct records', async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const result = await client.query(`
        SELECT name_en, name_hi, category, state, display_order
        FROM exams
        ORDER BY display_order;
      `);

      expect(result.rows.length).toBe(10);

      // Check first record
      expect(result.rows[0].name_en).toBe('UP Police Constable');
      expect(result.rows[0].name_hi).toBe('यूपी पुलिस कांस्टेबल');
      expect(result.rows[0].category).toBe('state');
      expect(result.rows[0].state).toBe('Uttar Pradesh');

      // Check categories
      const stateExams = result.rows.filter((r) => r.category === 'state');
      const centralExams = result.rows.filter((r) => r.category === 'central');
      expect(stateExams.length).toBe(8);
      expect(centralExams.length).toBe(2);

      // Check SSC GD Constable (central, no state)
      const sscGD = result.rows.find((r) => r.name_en === 'SSC GD Constable');
      expect(sscGD).toBeDefined();
      expect(sscGD!.category).toBe('central');
      expect(sscGD!.state).toBeNull();
    } finally {
      await client.end();
    }
  });

  it('should run down migrations successfully', async () => {
    // Run down to undo all migrations
    await expect(
      runMigrations({ databaseUrl, direction: 'down', verbose: false, count: 6 })
    ).resolves.not.toThrow();

    // Verify tables are removed
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const result = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name NOT LIKE 'pg%';
      `);

      const tableNames = result.rows.map((r) => r.table_name);
      expect(tableNames).not.toContain('exams');
      expect(tableNames).not.toContain('users');
      expect(tableNames).not.toContain('sessions');
      expect(tableNames).not.toContain('account_links');
      expect(tableNames).not.toContain('auth_audit_log');
    } finally {
      await client.end();
    }
  });
});
