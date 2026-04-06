import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Client } = pg;

async function reloadSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('Schema cache reloaded.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

reloadSchema();
