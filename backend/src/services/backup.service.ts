import { prisma } from '../lib/prisma.js';
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
const isWindows = process.platform === 'win32';
const PG_DUMP_PATH = process.env.PG_DUMP_PATH || (isWindows ? 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe' : 'pg_dump');
const PG_RESTORE_PATH = process.env.PG_RESTORE_PATH || (isWindows ? 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe' : 'pg_restore');

export class BackupService {
  static activeInterval: NodeJS.Timeout | null = null;

  static async init() {
    if (!fs.existsSync(finalBackupDir)) {
      fs.mkdirSync(finalBackupDir, { recursive: true });
    }
  }

  static async loadConfig() {
    try {
      const setting = await prisma.platformSettings.findUnique({
        where: { key: 'backup_config' }
      });
      if (setting && typeof setting.value === 'object' && setting.value !== null) {
        const val = setting.value as any;
        return {
          interval: val.interval || '24h',
          maxBackups: typeof val.maxBackups === 'number' ? val.maxBackups : 100,
          enabled: val.enabled !== false
        };
      }
    } catch (err) {
      console.error('Failed to load backup config:', err);
    }
    return { interval: '24h', maxBackups: 100, enabled: true };
  }

  static async startScheduler() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }

    const config = await this.loadConfig();
    if (!config.enabled || config.interval === 'disabled') {
      console.log('Automated backups are currently disabled.');
      return;
    }

    let intervalMs = 24 * 60 * 60 * 1000; // default 24h
    switch (config.interval) {
      case '1m':
        intervalMs = 60 * 1000;
        break;
      case '1h':
        intervalMs = 60 * 60 * 1000;
        break;
      case '12h':
        intervalMs = 12 * 60 * 60 * 1000;
        break;
      case '24h':
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        intervalMs = 7 * 24 * 60 * 60 * 1000;
        break;
    }

    console.log(`Starting automated backup scheduler: Interval = ${config.interval} (${intervalMs}ms), Max Backups = ${config.maxBackups}`);

    this.activeInterval = setInterval(async () => {
      try {
        console.log('Running scheduled automated backup...');
        await this.createBackup();
      } catch (error) {
        console.error('Scheduled automated backup failed:', error);
      }
    }, intervalMs);
  }

  static async updateConfig(newConfig: { interval: string; maxBackups: number; enabled: boolean }) {
    await prisma.platformSettings.upsert({
      where: { key: 'backup_config' },
      update: { value: newConfig },
      create: { key: 'backup_config', value: newConfig }
    });
    console.log('Backup configuration updated:', newConfig);
    await this.startScheduler();
  }

  static async createBackup(): Promise<string> {
    await this.init();

    // Run cleanup BEFORE creating a new backup to ensure we have disk space if at maximum capacity
    await this.cleanup();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.dump`;
    const filePath = path.join(finalBackupDir, filename);

    const dbUrl = process.env.DATABASE_URL || '';
    let host: string, port: string, user: string, password: string, dbname: string;
    try {
      const parsedUrl = new URL(dbUrl);
      host = parsedUrl.hostname;
      port = parsedUrl.port || '5432';
      user = parsedUrl.username;
      password = decodeURIComponent(parsedUrl.password);
      dbname = parsedUrl.pathname.replace(/^\//, '');
      if (!host || !user || !dbname) {
        throw new Error('Missing database connection fields');
      }
    } catch (err) {
      throw new Error('Invalid DATABASE_URL format: ' + (err instanceof Error ? err.message : String(err)));
    }

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
      const config = await this.loadConfig();
      const maxBackups = config.maxBackups;
      const files = await readdir(finalBackupDir);
      const backupFiles = files.filter(f => (f.startsWith('backup-')) && (f.endsWith('.sql') || f.endsWith('.dump')));

      if (backupFiles.length >= maxBackups) {
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

        // Delete enough old backups to make room for 1 new backup
        const filesToDelete = fileStats.slice(0, backupFiles.length - maxBackups + 1);
        
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
    let host: string, port: string, user: string, password: string, dbname: string;
    try {
      const parsedUrl = new URL(dbUrl);
      host = parsedUrl.hostname;
      port = parsedUrl.port || '5432';
      user = parsedUrl.username;
      password = decodeURIComponent(parsedUrl.password);
      dbname = parsedUrl.pathname.replace(/^\//, '');
      if (!host || !user || !dbname) {
        throw new Error('Missing database connection fields');
      }
    } catch (err) {
      throw new Error('Invalid DATABASE_URL format: ' + (err instanceof Error ? err.message : String(err)));
    }

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
