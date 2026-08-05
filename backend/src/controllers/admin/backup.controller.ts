import { Request, Response } from 'express';
import { BackupService } from '../../services/backup.service.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import path from 'path';
import fs from 'fs';

export const listBackups = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, startDate, endDate, search } = req.query;
  const result = await BackupService.listBackups({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    startDate: startDate as string,
    endDate: endDate as string,
    search: search as string
  });
  console.log(`API returning ${result.backups.length} backups (Page ${result.currentPage}/${result.totalPages})`);
  res.json({ status: 'success', data: result });
});

export const triggerBackup = asyncHandler(async (req: Request, res: Response) => {
  // Fire and forget to avoid hanging the HTTP request
  BackupService.createBackup().catch(err => {
    console.error('Background manual backup failed:', err);
  });
  res.json({ status: 'success', message: 'La sauvegarde manuelle a démarré en arrière-plan.' });
});

export const downloadBackup = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = BackupService.getBackupPath(String(filename));

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ status: 'error', message: 'Backup file not found' });
  }

  res.download(filePath);
});

export const deleteBackup = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = BackupService.getBackupPath(String(filename));

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json({ status: 'success', message: 'Backup deleted' });
});

export const restoreBackup = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  console.log(`Restoration attempt initiated for backup: ${filename}`);
  await BackupService.restoreBackup(String(filename));
  res.json({ status: 'success', message: 'Database restored successfully' });
});

export const getBackupConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await BackupService.loadConfig();
  res.json({ status: 'success', data: config });
});

export const updateBackupConfig = asyncHandler(async (req: Request, res: Response) => {
  const { interval, maxBackups, enabled, excludeSessionData } = req.body;
  if (typeof interval !== 'string' || typeof maxBackups !== 'number' || typeof enabled !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'Invalid payload' });
  }
  await BackupService.updateConfig({
    interval,
    maxBackups,
    enabled,
    // Omitted by older clients — keep skipping session data rather than silently
    // reverting to multi-GB snapshots.
    excludeSessionData: excludeSessionData !== false
  });
  res.json({ status: 'success', message: 'Backup configuration updated successfully' });
});
