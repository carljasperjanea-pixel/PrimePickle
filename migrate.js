import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await pool.query('ALTER TABLE public.club_achievements ADD COLUMN IF NOT EXISTS image_url TEXT;');
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed', err);
  } finally {
    pool.end();
  }
}

run();
