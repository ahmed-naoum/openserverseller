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
  const filename = await BackupService.createBackup();
  res.json({ status: 'success', message: 'Backup created successfully', data: { filename } });
});

export const downloadBackup = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = BackupService.getBackupPath(filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ status: 'error', message: 'Backup file not found' });
  }

  res.download(filePath);
});

export const deleteBackup = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = BackupService.getBackupPath(filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json({ status: 'success', message: 'Backup deleted' });
});

export const restoreBackup = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;
  console.log(`Restoration attempt initiated for backup: ${filename}`);
  await BackupService.restoreBackup(filename);
  res.json({ status: 'success', message: 'Database restored successfully' });
});
