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

// Session replay streams (SessionRecording.eventDataGzip) are the bulk of the DB —
// tens of thousands of gzipped rrweb blobs that are purged after 7 days anyway.
// Dumping them makes every snapshot ~8x larger for data nobody restores.
// The table DDL is still dumped (only its rows are skipped), so a restore into a
// fresh database still recreates the table and the app boots normally.
// The lightweight funnel tables it correlates with — checkout_attempts (Paniers)
// and signup_attempts (Inscriptions) — are plain text rows and stay in the backup.
const SESSION_DATA_TABLES = ['public.session_recordings'];

// A count cap alone cannot bound disk use, because it says nothing about how big
// each dump is. At ~285 MB/dump a maxBackups of 1000 authorises 285 GB on a 96 GB
// filesystem — the cap can never bind before the disk fills, so FIFO runs happily
// while the volume goes to 100%. That is not hypothetical: it is exactly how this
// directory reached 53 GB / 261 files.
//
// 40 GB sits deliberately above the current ~25 GB footprint, so introducing this
// ceiling evicts nothing on the deploy that ships it, while still binding long
// before a 96 GB disk is in trouble. Raise it in the admin UI if the DB outgrows it.
const DEFAULT_MAX_BYTES = 40 * 1024 * 1024 * 1024;

export interface BackupFileInfo {
  filename: string;
  /** mtime in ms — oldest is evicted first. */
  time: number;
  size: number;
}

export interface EvictionPlan {
  evict: string[];
  /** Which ceiling actually forced the eviction, for the log line. */
  reason: 'none' | 'count' | 'size' | 'both';
  bytesAfter: number;
}

/**
 * Decide which dumps to drop so that, once `incomingBytes` is written, BOTH the
 * count ceiling and the byte ceiling hold. Pure: no fs, no prisma, no clock.
 *
 * Both loops reserve room for the incoming dump — cleanup() runs before the new
 * backup is written, so "fits" means "fits with the next one included".
 *
 * The newest dump is never evicted. Without that floor a single dump larger than
 * maxBytes would empty the directory on every run and leave no restore point at
 * all — strictly worse than being over budget.
 */
export function planEviction(
  files: BackupFileInfo[],
  opts: { maxBackups: number; maxBytes: number; incomingBytes?: number }
): EvictionPlan {
  const { maxBackups, maxBytes } = opts;
  // Dumps grow monotonically, so the newest is the best estimate of the next one.
  const sorted = [...files].sort((a, b) => a.time - b.time);
  const incomingBytes = opts.incomingBytes ?? (sorted.length ? sorted[sorted.length - 1].size : 0);

  const keep = [...sorted];
  const evict: string[] = [];
  let byCount = false;
  let bySize = false;

  // Count ceiling: keep at most maxBackups - 1, leaving a slot for the incoming dump.
  while (keep.length > 0 && keep.length + 1 > maxBackups) {
    evict.push(keep.shift()!.filename);
    byCount = true;
  }

  // Byte ceiling: same idea, but stop before emptying the directory.
  let bytes = keep.reduce((sum, f) => sum + f.size, 0);
  while (keep.length > 1 && bytes + incomingBytes > maxBytes) {
    const dropped = keep.shift()!;
    bytes -= dropped.size;
    evict.push(dropped.filename);
    bySize = true;
  }

  const reason: EvictionPlan['reason'] =
    byCount && bySize ? 'both' : byCount ? 'count' : bySize ? 'size' : 'none';

  return { evict, reason, bytesAfter: bytes };
}

/**
 * stat() each dump, dropping any that no longer exists.
 *
 * A dump can vanish between readdir() and stat() — a concurrent cleanup, a manual
 * rm, a restore swapping files. cleanup() now stats on every call rather than only
 * when the count cap trips, so it meets that race far more often, and a bare
 * Promise.all would reject on the first ENOENT and abort the entire run. A file
 * that is already gone needs no eviction; anything other than ENOENT is a real
 * fault and still throws.
 */
export async function statBackups(dir: string, filenames: string[]): Promise<BackupFileInfo[]> {
  const settled = await Promise.all(
    filenames.map(async (f): Promise<BackupFileInfo | null> => {
      try {
        const s = await stat(path.join(dir, f));
        return { filename: f, time: s.mtime.getTime(), size: s.size };
      } catch (err: any) {
        if (err?.code === 'ENOENT') return null;
        throw err;
      }
    })
  );
  return settled.filter((f): f is BackupFileInfo => f !== null);
}

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
          // Configs written before the byte ceiling existed have no maxBytes key,
          // and those are precisely the ones that ran unbounded — so an absent
          // value must fall back to the default ceiling, never to "no limit".
          maxBytes: typeof val.maxBytes === 'number' && val.maxBytes > 0 ? val.maxBytes : DEFAULT_MAX_BYTES,
          enabled: val.enabled !== false,
          // Opt-out flag: configs saved before this option existed skip session data too.
          excludeSessionData: val.excludeSessionData !== false
        };
      }
    } catch (err) {
      console.error('Failed to load backup config:', err);
    }
    return { interval: '24h', maxBackups: 100, maxBytes: DEFAULT_MAX_BYTES, enabled: true, excludeSessionData: true };
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

  static async updateConfig(newConfig: { interval: string; maxBackups: number; maxBytes?: number; enabled: boolean; excludeSessionData: boolean }) {
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

    const config = await this.loadConfig();
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

    // Keep the table definitions, drop only their rows.
    const excludeArgs = config.excludeSessionData
      ? SESSION_DATA_TABLES.map(t => `--exclude-table-data=${t}`)
      : [];

    return new Promise((resolve, reject) => {
      const dumpProcess = spawn(PG_DUMP_PATH, [
        '-h', host,
        '-p', port,
        '-U', user,
        '-d', dbname,
        '-Fc', // Custom format (compressed)
        ...excludeArgs,
        '-f', filePath
      ], {
        env: { ...process.env, PGPASSWORD: password }
      });

      dumpProcess.on('close', async (code) => {
        if (code === 0) {
          const skipped = config.excludeSessionData ? ' (session replay data excluded)' : '';
          let sizeLabel = '';
          try {
            const { size } = await stat(filePath);
            sizeLabel = ` — ${(size / 1024 / 1024).toFixed(1)} MB`;
          } catch { /* size is only for the log line */ }

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
      const files = await readdir(finalBackupDir);
      const backupFiles = files.filter(f => (f.startsWith('backup-')) && (f.endsWith('.sql') || f.endsWith('.dump')));
      if (backupFiles.length === 0) return;

      // stat() every dump, not just when the count cap is tripped: the byte
      // ceiling can bind while the count is still comfortably under its limit,
      // which is the whole failure this guards against.
      //
      // A dump can vanish between readdir() and stat() — a concurrent cleanup, a
      // manual rm, a restore swapping files. Because this now stats on every call
      // rather than only when the count cap trips, it meets that race far more
      // often, and a bare Promise.all would reject on the first ENOENT and abort
      // the whole run. A file that no longer exists is already evicted, so skip it
      // and carry on; anything else is a real fault and still throws.
      const fileStats = await statBackups(finalBackupDir, backupFiles);
      if (fileStats.length === 0) return;

      const { evict, reason, bytesAfter } = planEviction(fileStats, {
        maxBackups: config.maxBackups,
        maxBytes: config.maxBytes
      });

      if (evict.length === 0) return;

      // Size-driven eviction means the count cap was never going to save this
      // directory — worth saying out loud rather than burying it in FIFO noise.
      if (reason === 'size' || reason === 'both') {
        const gb = (n: number) => (n / 1024 / 1024 / 1024).toFixed(2);
        console.warn(
          `Backup cleanup evicting for SIZE (reason=${reason}): ${evict.length} file(s), ` +
          `${gb(bytesAfter)} GB retained against a ${gb(config.maxBytes)} GB ceiling. ` +
          `maxBackups=${config.maxBackups} did not bind — dumps have outgrown the count cap.`
        );
      }

      for (const filename of evict) {
        try {
          await unlink(path.join(finalBackupDir, filename));
          console.log(`Deleted old backup: ${filename} (FIFO, reason=${reason})`);
        } catch (err: any) {
          // Same race, one step later: the file can go between planning and
          // unlinking. Losing the rest of the eviction list to an already-deleted
          // file is how a directory stays over budget indefinitely.
          if (err?.code !== 'ENOENT') throw err;
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
