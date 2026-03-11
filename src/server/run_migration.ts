import { supabase } from './supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migration_add_followers.sql'), 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      const { error } = await supabase.rpc('exec_sql', { sql_string: statement });
      if (error) {
        console.error('Error executing statement:', statement);
        console.error(error);
      }
    }
    console.log('Migration completed.');
  } catch (e) {
    console.error('Migration failed:', e);
  }
}

runMigration();
