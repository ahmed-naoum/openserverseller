/**
 * Deployment orchestration for the admin dashboard.
 *
 * THE CENTRAL CONSTRAINT
 * ----------------------
 * A deploy ends with `pm2 restart silacod-api`. If the deploy ran as a child of
 * this API process, that command kills the process running it — the log stream
 * dies mid-write and the outcome is never recorded, so every successful deploy
 * would look like a crash.
 *
 * So the runner is spawned DETACHED with its own process group and its stdio
 * redirected to a file on disk. It outlives the API that started it. The API
 * observes progress by tailing that file rather than by holding the child, and
 * `reconcileInterruptedDeploys()` reads the file on boot to settle any deploy
 * that was in flight across the restart.
 *
 * Everything else here is guardrails: a single-flight lock, an absolute
 * timeout, a fixed command (never taken from the request), and a full audit row
 * per attempt including failures.
 */

import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';

const execFileAsync = promisify(execFile);

/**
 * Repository root. Resolved from this file's location rather than hardcoded:
 * deploy.sh, setup.sh and ecosystem.config.cjs disagree about whether the
 * checkout lives at /var/www/openseller or /var/www/silacod, and guessing wrong
 * would run git commands against the wrong tree.
 *
 * dist/services/deploy.service.js -> dist -> backend -> repo root
 */
export const REPO_ROOT = path.resolve(process.cwd(), '..');
const LOG_DIR = path.join(process.cwd(), 'logs', 'deploys');

/** Deploys longer than this are declared TIMEOUT so the lock cannot wedge forever. */
const DEPLOY_TIMEOUT_MS = 15 * 60 * 1000;

/** Single-flight guard. Two concurrent `git pull` + `npm ci` runs corrupt a checkout. */
let activeDeploymentId: string | null = null;

export function isDeploying(): boolean {
  return activeDeploymentId !== null;
}

export function activeDeployment(): string | null {
  return activeDeploymentId;
}

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
}

/** Runs a git command in the repo. Never interpolates caller input into a shell. */
async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: REPO_ROOT,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
}

function parseCommits(raw: string): CommitInfo[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, author, date, ...rest] = line.split('\x1f');
      return {
        sha,
        shortSha: sha.slice(0, 7),
        message: rest.join('\x1f'),
        author,
        date,
      };
    });
}

export interface DeployStatus {
  branch: string;
  local: CommitInfo | null;
  remote: CommitInfo | null;
  behind: number;
  pending: CommitInfo[];
  upToDate: boolean;
  deploying: boolean;
  activeDeploymentId: string | null;
  dirty: boolean;
  error?: string;
}

/**
 * Current git state: what is checked out, what is on the remote, what is between.
 *
 * Runs `git fetch` first so "behind" reflects the remote rather than the last
 * time someone happened to fetch. Fetch is network I/O and can fail (no
 * credentials, no network); that is reported, not thrown, so the panel still
 * renders local state.
 */
export async function getDeployStatus(): Promise<DeployStatus> {
  const FMT = '--pretty=format:%H\x1f%an\x1f%aI\x1f%s';
  let error: string | undefined;

  let branch = 'master';
  try {
    branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    /* detached HEAD or not a repo — fall through with the default */
  }

  try {
    await git(['fetch', 'origin', branch, '--quiet']);
  } catch (err: any) {
    error = `git fetch failed: ${err.message?.slice(0, 200)}`;
  }

  const local = parseCommits(await git(['log', '-1', FMT]).catch(() => ''))[0] ?? null;

  let remote: CommitInfo | null = null;
  let pending: CommitInfo[] = [];
  try {
    remote = parseCommits(await git(['log', '-1', FMT, `origin/${branch}`]))[0] ?? null;
    pending = parseCommits(
      await git(['log', FMT, `HEAD..origin/${branch}`, '--max-count=50']),
    );
  } catch {
    /* no upstream configured yet */
  }

  let dirty = false;
  try {
    dirty = (await git(['status', '--porcelain'])).length > 0;
  } catch {
    /* ignore */
  }

  return {
    branch,
    local,
    remote,
    behind: pending.length,
    pending,
    upToDate: Boolean(local && remote && local.sha === remote.sha),
    deploying: isDeploying(),
    activeDeploymentId,
    dirty,
    error,
  };
}

type LogSink = (line: string) => void;

/**
 * Starts a deploy. Returns as soon as the detached runner is spawned — the
 * caller must not await completion, because completion involves this process
 * being restarted.
 */
export async function startDeploy(opts: {
  trigger: 'MANUAL' | 'WEBHOOK';
  triggeredById?: number;
  triggeredBy?: string;
  onLog?: LogSink;
  onStatus?: (status: string, deployment: any) => void;
}): Promise<{ id: string; logPath: string }> {
  if (activeDeploymentId) {
    throw new Error('A deployment is already running');
  }

  ensureLogDir();

  const status = await getDeployStatus();
  const target = status.remote ?? status.local;

  const deployment = await prisma.deployment.create({
    data: {
      commitSha: target?.sha ?? null,
      commitMessage: target?.message ?? null,
      commitAuthor: target?.author ?? null,
      branch: status.branch,
      status: 'RUNNING',
      trigger: opts.trigger,
      triggeredById: opts.triggeredById ?? null,
      triggeredBy: opts.triggeredBy ?? null,
      startedAt: new Date(),
    },
  });

  const logPath = path.join(LOG_DIR, `${deployment.id}.log`);
  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { logPath },
  });

  activeDeploymentId = deployment.id;
  opts.onStatus?.('RUNNING', deployment);

  // The command is fixed here and never derived from the request. `bash deploy.sh`
  // is the same script a human would run, so there is one deployment path to
  // reason about rather than two that can drift apart.
  const script = path.join(REPO_ROOT, 'deploy.sh');
  const child = spawn('bash', [script], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SILACOD_DEPLOY_ID: deployment.id,
      SILACOD_DEPLOY_LOG: logPath,
      // Non-interactive: a deploy must never block waiting for a prompt that
      // nobody can answer.
      CI: 'true',
      GIT_TERMINAL_PROMPT: '0',
      DEBIAN_FRONTEND: 'noninteractive',
    },
  });
  child.unref();

  const { createWriteStream } = await import('node:fs');
  const logStream = createWriteStream(logPath, { flags: 'a' });

  const write = (chunk: Buffer | string, prefix = '') => {
    const text = chunk.toString();
    logStream.write(prefix ? text.replace(/^/gm, prefix) : text);
    for (const line of text.split('\n')) {
      if (line.trim()) opts.onLog?.(line);
    }
  };

  child.stdout?.on('data', (c) => write(c));
  child.stderr?.on('data', (c) => write(c, ''));

  const finish = async (
    finalStatus: string,
    exitCode: number | null,
    errorMessage?: string,
  ) => {
    if (activeDeploymentId !== deployment.id) return; // already settled
    activeDeploymentId = null;
    clearTimeout(timer);
    const finishedAt = new Date();
    try {
      const updated = await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: finalStatus,
          exitCode,
          errorMessage: errorMessage ?? null,
          finishedAt,
          durationMs: finishedAt.getTime() - deployment.startedAt!.getTime(),
        },
      });
      if (finalStatus === 'SUCCESS') {
        await prisma.pendingCommit.updateMany({
          where: { deployed: false },
          data: { deployed: true, deploymentId: deployment.id },
        });
      }
      opts.onStatus?.(finalStatus, updated);
    } catch (err) {
      console.error('[deploy] failed to record outcome:', err);
    }
    logStream.end();
  };

  const timer = setTimeout(() => {
    try {
      // Negative pid kills the whole detached process group, not just bash.
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      /* already gone */
    }
    finish('TIMEOUT', null, `Deploy exceeded ${DEPLOY_TIMEOUT_MS / 60000} minutes`);
  }, DEPLOY_TIMEOUT_MS);

  child.on('exit', (code) => {
    finish(code === 0 ? 'SUCCESS' : 'FAILED', code);
  });

  child.on('error', (err) => {
    finish('FAILED', null, err.message);
  });

  // Let the parent exit independently of the child. This is what allows the
  // deploy to survive `pm2 restart silacod-api` at the end of the script.
  child.unref();

  return { id: deployment.id, logPath };
}

/** Reads a deploy log from disk, newest N bytes, for the panel to display. */
export async function readDeployLog(
  deploymentId: string,
  maxBytes = 256 * 1024,
): Promise<string> {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    select: { logPath: true },
  });
  if (!deployment?.logPath || !existsSync(deployment.logPath)) return '';

  const { size } = await stat(deployment.logPath);
  if (size <= maxBytes) return readFile(deployment.logPath, 'utf8');

  return new Promise((resolve, reject) => {
    let out = '';
    createReadStream(deployment.logPath!, { start: size - maxBytes })
      .on('data', (c) => (out += c.toString()))
      .on('end', () => resolve(`… (truncated)\n${out}`))
      .on('error', reject);
  });
}

/**
 * Settles deploys that were RUNNING when this process died.
 *
 * The expected case is benign: the deploy succeeded and its final step restarted
 * us. But the row still says RUNNING, and — worse — `activeDeploymentId` resets
 * to null on restart, so without this the lock and the UI disagree with the
 * database forever. Called once at boot.
 */
export async function reconcileInterruptedDeploys(): Promise<void> {
  try {
    const stuck = await prisma.deployment.findMany({
      where: { status: 'RUNNING' },
      orderBy: { createdAt: 'desc' },
    });
    for (const d of stuck) {
      // If the log ends with the script's success marker, the deploy finished and
      // simply took us down with it. Otherwise we genuinely do not know.
      let finalStatus = 'UNKNOWN';
      if (d.logPath && existsSync(d.logPath)) {
        const tail = await readDeployLog(d.id, 8192);
        if (tail.includes('DEPLOY_RESULT=SUCCESS')) finalStatus = 'SUCCESS';
        else if (tail.includes('DEPLOY_RESULT=FAILED')) finalStatus = 'FAILED';
      }
      const finishedAt = new Date();
      await prisma.deployment.update({
        where: { id: d.id },
        data: {
          status: finalStatus,
          finishedAt,
          durationMs: d.startedAt
            ? finishedAt.getTime() - d.startedAt.getTime()
            : null,
          errorMessage:
            finalStatus === 'UNKNOWN'
              ? 'API restarted while deploying; outcome could not be confirmed'
              : null,
        },
      });
      if (finalStatus === 'SUCCESS') {
        await prisma.pendingCommit.updateMany({
          where: { deployed: false },
          data: { deployed: true, deploymentId: d.id },
        });
      }
    }
    if (stuck.length) {
      console.log(`[deploy] reconciled ${stuck.length} interrupted deployment(s)`);
    }
  } catch (err: any) {
    // P2021 = table does not exist. Expected on any checkout where the schema
    // has not been pushed yet, including the first boot after pulling this
    // feature. Say so in one line rather than printing a stack trace that looks
    // like a crash — the deploy panel simply stays unavailable until the tables
    // are created.
    if (err?.code === 'P2021') {
      console.warn(
        '[deploy] tables not found — run `npx prisma db push` to enable the deployment panel',
      );
      return;
    }
    console.error('[deploy] reconcile failed:', err);
  }
}
