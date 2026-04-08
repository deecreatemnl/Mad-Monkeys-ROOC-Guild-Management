import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present (for local development)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Client } = pg;

async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  
  if (!dbUrl) {
    console.warn('⚠️ Database connection URL is not set. Skipping migrations.');
    console.warn('To enable auto-migrations, add DATABASE_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL to your environment variables.');
    return;
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Also set environment variable as a fallback for some environments
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    await client.connect();
    console.log('📦 Connected to database for migrations.');

    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT id FROM _migrations WHERE name = $1', [file]);
      
      if (rows.length === 0) {
        console.log(`⏳ Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✅ Successfully applied: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`❌ Failed to apply migration: ${file}`);
          throw err;
        }
      }
    }
    
    console.log('✨ All migrations are up to date.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
