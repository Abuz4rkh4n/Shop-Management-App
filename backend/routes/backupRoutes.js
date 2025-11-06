import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createBackup, restoreBackup, getBackupInfo } from '../utils/backupService.js';

const router = express.Router();

// Middleware to check if user is superadmin
const isSuperAdmin = (req, res, next) => {
  if (req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Superadmin privileges required.' });
  }
};

// Get backup info (last backup time)
router.get('/backup-info', authenticateToken, (req, res) => {
  try {
    const info = getBackupInfo();
    res.json(info);
  } catch (error) {
    console.error('Error getting backup info:', error);
    res.status(500).json({ message: 'Failed to get backup info' });
  }
});

// Create a backup (admin only)
router.post('/backup', authenticateToken, async (req, res) => {
  try {
    const result = await createBackup();
    res.json({ 
      message: 'Backup created successfully',
      lastBackup: result.lastBackup
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ 
      message: 'Failed to create backup',
      error: error.message 
    });
  }
});

// Restore from backup (superadmin only)
router.post('/restore', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    await restoreBackup();
    res.json({ message: 'Database restored successfully' });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ 
      message: 'Failed to restore database',
      error: error.message 
    });
  }
});

export default router;
