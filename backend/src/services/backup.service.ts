import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

const BACKUP_DIR = path.join(process.cwd(), 'backups');
// Ensure we are in the backend directory if running from root
const finalBackupDir = fs.existsSync(path.join(process.cwd(), 'backend')) 
  ? path.join(process.cwd(), 'backend', 'backups')
  : BACKUP_DIR;
const PG_DUMP_PATH = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
const MAX_BACKUPS = 10000;

export class BackupService {
  static async init() {
    if (!fs.existsSync(finalBackupDir)) {
      fs.mkdirSync(finalBackupDir, { recursive: true });
    }
  }

  static async createBackup(): Promise<string> {
    await this.init();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.dump`;
    const filePath = path.join(finalBackupDir, filename);

    const dbUrl = process.env.DATABASE_URL || '';
    // Parse connection string for pg_dump
    // postgresql://user:pass@host:port/db
    const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = dbUrl.match(urlPattern);

    if (!match) {
      throw new Error('Invalid DATABASE_URL format');
    }

    const [_, user, password, host, port, dbname] = match;

    return new Promise((resolve, reject) => {
      const dumpProcess = spawn(PG_DUMP_PATH, [
        '-h', host,
        '-p', port,
        '-U', user,
        '-d', dbname,
        '-Fc', // Custom format (compressed)
        '-f', filePath
      ], {
        env: { ...process.env, PGPASSWORD: password }
      });

      dumpProcess.on('close', async (code) => {
        if (code === 0) {
          console.log(`Backup created successfully: ${filename}`);
          await this.cleanup();
          resolve(filename);
        } else {
          reject(new Error(`pg_dump failed with code ${code}`));
        }
      });

      dumpProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  static async cleanup() {
    try {
      const files = await readdir(finalBackupDir);
      const backupFiles = files.filter(f => (f.startsWith('backup-')) && (f.endsWith('.sql') || f.endsWith('.dump')));

      if (backupFiles.length > MAX_BACKUPS) {
        // Get file stats to sort by creation time
        const fileStats = await Promise.all(
          backupFiles.map(async (f) => {
            const fullPath = path.join(finalBackupDir, f);
            const s = await stat(fullPath);
            return { filename: f, time: s.mtime.getTime() };
          })
        );

        // Sort by time (oldest first)
        fileStats.sort((a, b) => a.time - b.time);

        const filesToDelete = fileStats.slice(0, backupFiles.length - MAX_BACKUPS);
        
        for (const file of filesToDelete) {
          await unlink(path.join(finalBackupDir, file.filename));
          console.log(`Deleted old backup: ${file.filename} (FIFO)`);
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  static async listBackups() {
    try {
      await this.init();
      console.log(`Checking backups in: ${finalBackupDir}`);
      
      if (!fs.existsSync(finalBackupDir)) {
        console.error(`Backup directory does not exist: ${finalBackupDir}`);
        return [];
      }

      const files = await readdir(finalBackupDir);
      console.log(`Scanning ${finalBackupDir}, found ${files.length} total files`);
      
      const backupFiles = files.filter(f => (f.startsWith('backup-')) && (f.endsWith('.sql') || f.endsWith('.dump')));
      console.log(`Matched ${backupFiles.length} backup files`);

      const fileList = await Promise.all(
        backupFiles.map(async (f) => {
          try {
            const fullPath = path.join(finalBackupDir, f);
            const s = await stat(fullPath);
            return {
              filename: f,
              size: s.size,
              createdAt: s.mtime,
            };
          } catch (err) {
            console.error(`Error stating file ${f}:`, err);
            return null;
          }
        })
      );

      const validFiles = fileList.filter((f): f is any => f !== null);
      return validFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('List backups failed:', error);
      throw error;
    }
  }

  static getBackupPath(filename: string) {
    return path.join(finalBackupDir, filename);
  }
}
