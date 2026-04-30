import { Request, Response } from 'express';
import { BackupService } from '../../services/backup.service.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import path from 'path';
import fs from 'fs';

export const listBackups = asyncHandler(async (req: Request, res: Response) => {
  const backups = await BackupService.listBackups();
  console.log(`API returning ${backups.length} backups to client`);
  res.json({ status: 'success', data: backups });
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
