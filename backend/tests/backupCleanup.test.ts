import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { planEviction, statBackups, type BackupFileInfo } from '../src/services/backup.service';

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

/** n dumps, oldest first, 1 hour apart, each `size` bytes. */
function dumps(n: number, size: number): BackupFileInfo[] {
  return Array.from({ length: n }, (_, i) => ({
    filename: `backup-${String(i).padStart(3, '0')}.dump`,
    time: i * 3600_000,
    size,
  }));
}

describe('planEviction — count ceiling', () => {
  it('reserves a slot for the incoming dump, matching the original FIFO math', () => {
    // The behaviour this replaces: 261 files, cap 100 -> delete 162, leave 99.
    const plan = planEviction(dumps(261, 1 * MB), { maxBackups: 100, maxBytes: 1000 * GB });
    expect(plan.evict).toHaveLength(162);
    expect(plan.reason).toBe('count');
    expect(261 - plan.evict.length).toBe(99);
  });

  it('evicts oldest first', () => {
    const plan = planEviction(dumps(5, 1 * MB), { maxBackups: 3, maxBytes: 1000 * GB });
    expect(plan.evict).toEqual(['backup-000.dump', 'backup-001.dump', 'backup-002.dump']);
  });

  it('does nothing when under both ceilings', () => {
    const plan = planEviction(dumps(10, 1 * MB), { maxBackups: 100, maxBytes: 40 * GB });
    expect(plan.evict).toEqual([]);
    expect(plan.reason).toBe('none');
  });

  it('is unaffected by input ordering', () => {
    const shuffled = [...dumps(5, 1 * MB)].reverse();
    const plan = planEviction(shuffled, { maxBackups: 3, maxBytes: 1000 * GB });
    expect(plan.evict).toEqual(['backup-000.dump', 'backup-001.dump', 'backup-002.dump']);
  });
});

describe('planEviction — byte ceiling', () => {
  it('binds even when the count cap is nowhere near tripping', () => {
    // The real bug: 100 dumps of 285 MB is ~28 GB under a cap of 1000 files.
    // Count says "fine"; bytes say otherwise.
    const plan = planEviction(dumps(100, 285 * MB), { maxBackups: 1000, maxBytes: 10 * GB });
    expect(plan.reason).toBe('size');
    expect(plan.evict.length).toBeGreaterThan(0);
    expect(plan.bytesAfter + 285 * MB).toBeLessThanOrEqual(10 * GB);
  });

  it('reports reason="both" when each ceiling evicts on its own', () => {
    const plan = planEviction(dumps(200, 285 * MB), { maxBackups: 100, maxBytes: 10 * GB });
    expect(plan.reason).toBe('both');
  });

  it('leaves room for the incoming dump, not merely the retained set', () => {
    // 9 GB retained under a 10 GB ceiling "fits" — until a 2 GB dump lands.
    const plan = planEviction(dumps(9, 1 * GB), {
      maxBackups: 1000,
      maxBytes: 10 * GB,
      incomingBytes: 2 * GB,
    });
    expect(plan.bytesAfter + 2 * GB).toBeLessThanOrEqual(10 * GB);
  });

  it('estimates the incoming dump from the newest file when not supplied', () => {
    const growing = dumps(4, 1 * GB);
    growing[growing.length - 1].size = 4 * GB; // newest is the biggest
    const plan = planEviction(growing, { maxBackups: 1000, maxBytes: 8 * GB });
    // Must budget 4 GB for the next one, not 1 GB.
    expect(plan.bytesAfter + 4 * GB).toBeLessThanOrEqual(8 * GB);
  });
});

describe('planEviction — floors and edges', () => {
  it('never empties the directory, even when one dump exceeds the ceiling', () => {
    const plan = planEviction(dumps(5, 50 * GB), { maxBackups: 1000, maxBytes: 1 * GB });
    expect(plan.evict).toHaveLength(4);
    expect(plan.bytesAfter).toBe(50 * GB); // over budget, but a restore point survives
  });

  it('keeps the newest dump specifically, not an arbitrary survivor', () => {
    const plan = planEviction(dumps(5, 50 * GB), { maxBackups: 1000, maxBytes: 1 * GB });
    expect(plan.evict).not.toContain('backup-004.dump');
  });

  it('handles an empty directory', () => {
    const plan = planEviction([], { maxBackups: 100, maxBytes: 40 * GB });
    expect(plan.evict).toEqual([]);
    expect(plan.reason).toBe('none');
    expect(plan.bytesAfter).toBe(0);
  });

  it('does not mutate its input', () => {
    const input = dumps(5, 1 * MB);
    const snapshot = input.map((f) => f.filename);
    planEviction(input, { maxBackups: 2, maxBytes: 1 * MB });
    expect(input.map((f) => f.filename)).toEqual(snapshot);
    expect(input).toHaveLength(5);
  });

  it('the 40 GB default evicts nothing at the current ~25 GB footprint', () => {
    // Guards the deploy-day promise: shipping the ceiling must not delete backups.
    const plan = planEviction(dumps(100, 256 * MB), { maxBackups: 1000, maxBytes: 40 * GB });
    expect(plan.evict).toEqual([]);
  });
});

describe('statBackups — survives files vanishing mid-run', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'backup-stat-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads size and mtime for files that exist', async () => {
    await writeFile(path.join(dir, 'backup-a.dump'), 'x'.repeat(128));
    const stats = await statBackups(dir, ['backup-a.dump']);
    expect(stats).toHaveLength(1);
    expect(stats[0].filename).toBe('backup-a.dump');
    expect(stats[0].size).toBe(128);
    expect(stats[0].time).toBeGreaterThan(0);
  });

  it('skips a file deleted between readdir and stat rather than throwing', async () => {
    // The exact race seen on the server:
    //   Error stating file backup-2026-08-06T08-04-02-087Z.dump: ENOENT
    // A bare Promise.all rejects here and aborts the whole cleanup run.
    await writeFile(path.join(dir, 'backup-a.dump'), 'aa');
    await writeFile(path.join(dir, 'backup-c.dump'), 'cccc');

    const stats = await statBackups(dir, [
      'backup-a.dump',
      'backup-b.dump', // never existed — stands in for one deleted mid-run
      'backup-c.dump',
    ]);

    expect(stats.map((s) => s.filename)).toEqual(['backup-a.dump', 'backup-c.dump']);
  });

  it('returns empty rather than throwing when every file has vanished', async () => {
    const stats = await statBackups(dir, ['gone-1.dump', 'gone-2.dump']);
    expect(stats).toEqual([]);
  });

  it('still surfaces non-ENOENT failures', async () => {
    if (process.platform === 'win32') {
      await expect(statBackups(dir, ['backup\0invalid.dump'])).rejects.toThrow();
    } else {
      await writeFile(path.join(dir, 'not-a-dir'), 'x');
      await expect(statBackups(dir, ['not-a-dir/backup-a.dump'])).rejects.toThrow(/ENOTDIR/);
    }
  });

  it('feeds planEviction directly, so a vanished file cannot skew the byte total', async () => {
    await writeFile(path.join(dir, 'backup-a.dump'), 'x'.repeat(1000));
    await writeFile(path.join(dir, 'backup-b.dump'), 'x'.repeat(1000));
    const stats = await statBackups(dir, ['backup-a.dump', 'backup-gone.dump', 'backup-b.dump']);
    const plan = planEviction(stats, { maxBackups: 100, maxBytes: 10_000 });
    expect(plan.evict).toEqual([]);
    expect(plan.bytesAfter).toBe(2000); // not 3000 — the missing file contributes nothing
  });
});
