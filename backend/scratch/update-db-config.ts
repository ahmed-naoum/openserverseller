import { BackupService } from '../src/services/backup.service';

async function main() {
  console.log('Optimizing backup config...');
  await BackupService.updateConfig({
    interval: '24h',
    maxBackups: 100,
    enabled: true
  });
  console.log('Successfully updated backup configuration in database to 24h interval / 100 max backups.');
}

main().catch(err => {
  console.error('Failed to update config:', err);
  process.exit(1);
});
