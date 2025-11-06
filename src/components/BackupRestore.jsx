import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const BackupRestore = () => {
  const { user } = useAuth();
  const [lastBackup, setLastBackup] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Fetch last backup info on component mount
  useEffect(() => {
    fetchBackupInfo();
  }, []);

  const fetchBackupInfo = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/backup-info', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLastBackup(data.lastBackup);
      }
    } catch (error) {
      console.error('Error fetching backup info:', error);
      toast.error('Failed to fetch backup information');
    }
  };

  const handleBackup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        setLastBackup(data.lastBackup);
        toast.success('Backup created successfully!');
      } else {
        throw new Error(data.message || 'Failed to create backup');
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error(`Backup failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success('Database restored successfully!');
        // Refresh backup info to show updated last backup time
        fetchBackupInfo();
      } else {
        throw new Error(data.message || 'Failed to restore database');
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast.error(`Restore failed: ${error.message}`);
    } finally {
      setIsLoading(false);
      setShowRestoreConfirm(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Database Backup & Restore</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Backup Status</h2>
        <div className="mb-6">
          <p className="text-gray-700">
            <span className="font-medium">Last Backup:</span>{' '}
            <span className={lastBackup ? 'text-green-600' : 'text-yellow-600'}>
              {formatDate(lastBackup)}
            </span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Automatic backups are created every 10 Seconds and saved to your Google Drive folder.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleBackup}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-white ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
          >
            {isLoading ? 'Creating Backup...' : 'Create Backup Now'}
          </button>

          {user?.role === 'superadmin' && (
            <button
              onClick={() => setShowRestoreConfirm(true)}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:bg-red-400"
            >
              Restore Database
            </button>
          )}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Confirm Database Restore</h3>
            <p className="text-gray-700 mb-6">
              Restoring the database will overwrite all current data with the last backup.
              <br />
              <span className="font-medium">Last backup:</span> {formatDate(lastBackup) || 'No backup available'}
              <br />
              <br />
              Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={isLoading || !lastBackup}
                className={`px-4 py-2 rounded-md text-white ${isLoading || !lastBackup ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'} transition-colors`}
              >
                {isLoading ? 'Restoring...' : 'Yes, Restore Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupRestore;
