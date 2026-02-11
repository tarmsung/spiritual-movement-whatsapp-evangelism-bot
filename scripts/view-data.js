import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../data/evangelism.db');
const db = new Database(DB_PATH);

console.log('\n=== ASSEMBLIES ===\n');
const assemblies = db.prepare('SELECT * FROM assemblies').all();
console.table(assemblies);

console.log('\n=== REPORTS ===\n');
const reports = db.prepare(`
  SELECT 
    r.id,
    r.reporter_name,
    a.name as assembly,
    r.activity_date,
    r.location,
    r.people_reached,
    r.conversions,
    r.activity_type,
    r.posted_to_group
  FROM reports r
  LEFT JOIN assemblies a ON r.assembly_id = a.id
  ORDER BY r.created_at DESC
  LIMIT 50
`).all();
console.table(reports);

console.log('\n=== STATISTICS ===\n');
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total_reports,
    SUM(people_reached) as total_reached,
    SUM(conversions) as total_conversions,
    ROUND(CAST(SUM(conversions) AS FLOAT) / NULLIF(SUM(people_reached), 0) * 100, 2) as conversion_rate
  FROM reports
`).get();
console.table([stats]);

console.log('\n=== USERS (Form States) ===\n');
const users = db.prepare('SELECT phone, current_form_step FROM users').all();
if (users.length > 0) {
    console.table(users);
} else {
    console.log('No active form sessions');
}

db.close();
