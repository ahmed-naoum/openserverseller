import { BackupService } from '../src/services/backup.service';

async function main() {
  console.log('Testing BackupService...');
  
  try {
    console.log('1. Loading config...');
    const config = await BackupService.loadConfig();
    console.log('Config loaded successfully:', config);
    
    console.log('2. Listing backups...');
    const list = await BackupService.listBackups();
    console.log('Backups listed successfully, count:', list.backups.length);
    console.log('Storage info:', list.storage);
    
    console.log('3. Triggering manual backup...');
    const filename = await BackupService.createBackup();
    console.log('Backup created successfully, filename:', filename);
  } catch (error) {
    console.error('BackupService test failed with error:', error);
  }
}

main();
