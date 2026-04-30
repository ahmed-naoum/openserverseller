import 'dotenv/config';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PG_RESTORE_PATH = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe';
const BACKUP_FILE = process.argv[2];

if (!BACKUP_FILE) {
  console.error('Usage: npx tsx restore-db.ts <filename>');
  process.exit(1);
}

const BACKUP_PATH = path.join(process.cwd(), 'backups', BACKUP_FILE);

if (!fs.existsSync(BACKUP_PATH)) {
  console.error(`File not found: ${BACKUP_PATH}`);
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || '';
const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
const match = dbUrl.match(urlPattern);

if (!match) {
  console.error('Invalid DATABASE_URL format');
  process.exit(1);
}

const [_, user, password, host, port, dbname] = match;

console.log(`Restoring ${BACKUP_FILE} to ${dbname} on ${host}...`);

const restoreProcess = spawn(PG_RESTORE_PATH, [
  '-h', host,
  '-p', port,
  '-U', user,
  '-d', dbname,
  '--clean',       // Drop existing objects before creating
  '--if-exists',   // Don't error if objects don't exist
  '--no-owner',    // Skip restoration of object ownership
  '--no-privileges', // Skip restoration of access privileges
  BACKUP_PATH
], {
  env: { ...process.env, PGPASSWORD: password }
});

restoreProcess.stdout.on('data', (data) => {
  console.log(data.toString());
});

restoreProcess.stderr.on('data', (data) => {
  // pg_restore often outputs warnings to stderr, which is normal
  console.error(data.toString());
});

restoreProcess.on('close', (code) => {
  if (code === 0) {
    console.log('Restoration completed successfully!');
  } else {
    console.error(`Restoration failed with code ${code}`);
  }
});
