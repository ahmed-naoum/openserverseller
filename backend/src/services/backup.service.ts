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
const PG_RESTORE_PATH = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe';
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

  static async listBackups(options: { 
    page?: number; 
    limit?: number; 
    startDate?: string; 
    endDate?: string; 
    search?: string 
  } = {}) {
    try {
      await this.init();
      
      if (!fs.existsSync(finalBackupDir)) {
        return { 
          backups: [], 
          totalSize: 0, 
          storage: { total: 0, free: 0, used: 0 },
          totalCount: 0,
          totalPages: 0,
          currentPage: 1
        };
      }

      const files = await readdir(finalBackupDir);
      const backupFiles = files.filter(f => (f.startsWith('backup-')) && (f.endsWith('.sql') || f.endsWith('.dump')));

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
      const totalSize = validFiles.reduce((acc, f) => acc + f.size, 0);

      // Apply Filters
      let filteredFiles = [...validFiles];

      if (options.search) {
        const s = options.search.toLowerCase();
        filteredFiles = filteredFiles.filter(f => f.filename.toLowerCase().includes(s));
      }

      if (options.startDate) {
        const start = new Date(options.startDate);
        filteredFiles = filteredFiles.filter(f => f.createdAt >= start);
      }

      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        filteredFiles = filteredFiles.filter(f => f.createdAt <= end);
      }

      // Sort by creation date (newest first)
      filteredFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Pagination
      const totalCount = filteredFiles.length;
      const limit = Number(options.limit) || 50;
      const page = Number(options.page) || 1;
      const startIndex = (page - 1) * limit;
      const paginatedFiles = filteredFiles.slice(startIndex, startIndex + limit);

      // Get server storage info
      let storage = { total: 0, free: 0, used: 0 };
      try {
        const stats = await fs.promises.statfs(finalBackupDir);
        storage.total = Number(stats.bsize) * Number(stats.blocks);
        storage.free = Number(stats.bsize) * Number(stats.bfree);
        storage.used = storage.total - storage.free;
      } catch (err) {
        console.error('Failed to get storage info:', err);
      }

      return {
        backups: paginatedFiles,
        totalSize,
        storage,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      };
    } catch (error) {
      console.error('List backups failed:', error);
      throw error;
    }
  }

  static getBackupPath(filename: string) {
    return path.join(finalBackupDir, filename);
  }

  static async restoreBackup(filename: string): Promise<void> {
    const filePath = this.getBackupPath(filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('Backup file not found');
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = dbUrl.match(urlPattern);

    if (!match) {
      throw new Error('Invalid DATABASE_URL format');
    }

    const [_, user, password, host, port, dbname] = match;

    return new Promise((resolve, reject) => {
      // Use pg_restore -c (clean) to drop objects before recreating them
      // --if-exists to avoid errors if objects don't exist
      const restoreProcess = spawn(PG_RESTORE_PATH, [
        '-h', host,
        '-p', port,
        '-U', user,
        '-d', dbname,
        '-c', 
        '--if-exists',
        '-Fc', 
        filePath
      ], {
        env: { ...process.env, PGPASSWORD: password }
      });

      restoreProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`Database restored successfully from: ${filename}`);
          resolve();
        } else {
          reject(new Error(`pg_restore failed with code ${code}`));
        }
      });

      restoreProcess.on('error', (err) => {
        reject(err);
      });
    });
  }
}
