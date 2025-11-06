import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to store backup info
const BACKUP_INFO_PATH = path.join(__dirname, '..', 'backup-info.json');

// Default backup path - points to Documents/Shop folder
const getBackupPath = () => {
  return path.join('C:\\Users\\abuza\\OneDrive\\Documents\\Shop', 'shop_backup.sql');
};

// Initialize backup info file if it doesn't exist
const initBackupInfo = () => {
  if (!fs.existsSync(BACKUP_INFO_PATH)) {
    fs.writeFileSync(
      BACKUP_INFO_PATH,
      JSON.stringify({ lastBackup: null }, null, 2)
    );
  }
};

// Update backup info with current timestamp
const updateBackupInfo = () => {
  const backupInfo = {
    lastBackup: new Date().toISOString(),
  };
  fs.writeFileSync(BACKUP_INFO_PATH, JSON.stringify(backupInfo, null, 2));
  return backupInfo;
};

// Get backup info
const getBackupInfo = () => {
  try {
    if (!fs.existsSync(BACKUP_INFO_PATH)) {
      initBackupInfo();
    }
    return JSON.parse(fs.readFileSync(BACKUP_INFO_PATH, 'utf8'));
  } catch (error) {
    console.error('Error reading backup info:', error);
    return { lastBackup: null };
  }
};

// Create a database backup
const createBackup = () => {
  return new Promise((resolve, reject) => {
    const backupPath = getBackupPath();
    const backupDir = path.dirname(backupPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Use the full path to mysqldump (common locations on Windows)
    const mysqldumpPath = [
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe',
      'C:\\Program Files (x86)\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
      'C:\\Program Files (x86)\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe',
      'mysqldump' // Fallback to PATH
    ].find(path => {
      try {
        fs.accessSync(path, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }) || 'mysqldump'; // Last resort, might still fail

    const command = `"${mysqldumpPath}" --host=${process.env.DB_HOST} --user=${process.env.DB_USER} --password=${process.env.DB_PASS} ${process.env.DB_NAME} > "${backupPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Backup failed: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Backup stderr: ${stderr}`);
      }
      
      const info = updateBackupInfo();
      console.log(`Backup created successfully at ${backupPath}`);
      resolve(info);
    });
  });
};

// Restore database from backup
const restoreBackup = () => {
  return new Promise((resolve, reject) => {
    const backupPath = getBackupPath();
    
    if (!fs.existsSync(backupPath)) {
      return reject(new Error('Backup file not found'));
    }

    // Use the full path to mysql (common locations on Windows)
    const mysqlPath = [
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysql.exe',
      'C:\\Program Files (x86)\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
      'C:\\Program Files (x86)\\MySQL\\MySQL Server 5.7\\bin\\mysql.exe',
      'mysql' // Fallback to PATH
    ].find(path => {
      try {
        fs.accessSync(path, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }) || 'mysql'; // Last resort, might still fail

    const command = `"${mysqlPath}" --host=${process.env.DB_HOST} --user=${process.env.DB_USER} --password=${process.env.DB_PASS} ${process.env.DB_NAME} < "${backupPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Restore failed: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Restore stderr: ${stderr}`);
      }
      
      console.log('Database restored successfully');
      resolve({ success: true });
    });
  });
};

// Schedule automatic backups (every 10 seconds for testing)
const scheduleBackups = () => {
  // Run every 10 seconds
  cron.schedule('*/10 * * * * *', async () => {
    try {
      console.log('Running scheduled backup...');
      await createBackup();
    } catch (error) {
      console.error('Scheduled backup failed:', error);
    }
  });
  console.log('Scheduled backup job initialized (runs every hour)');
};

// Initialize the backup system
const initBackupSystem = () => {
  initBackupInfo();
  scheduleBackups();
};

export {
  createBackup,
  restoreBackup,
  getBackupInfo,
  initBackupSystem,
  getBackupPath
};
