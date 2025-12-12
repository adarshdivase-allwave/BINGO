import React, { useState, useEffect } from 'react';
import { AppUser, ActivityLog, UserRole, UserStatus } from '../types';
import {
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  deleteUserAccount,
} from '../services/userManagementService';
import { fetchActivityLogs, exportActivityLogsAsCSV } from '../services/activityLogService';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
import TrashIcon from './icons/TrashIcon';
import DownloadIcon from './icons/DownloadIcon';
import SettingsIcon from './icons/SettingsIcon';
import PlusIcon from './icons/PlusIcon';
import CreateUserModal from './CreateUserModal';

interface AdminDashboardProps {
  currentUserEmail: string;
  currentUserId: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUserEmail, currentUserId }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [filterEmail, setFilterEmail] = useState('');

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  // Load logs when tab changes
  useEffect(() => {
    if (activeTab === 'logs') {
      loadActivityLogs();

      // Real-time subscription
      const sub = client.models.ActivityLog.onCreate().subscribe({
        next: (event: any) => {
          const newLog = event as unknown as ActivityLog;
          setActivityLogs((prev) => [newLog, ...prev]);
        },
        error: (err: any) => console.warn('Subscription warning:', err),
      });

      return () => sub.unsubscribe();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivityLogs = async () => {
    setIsLoading(true);
    try {
      const logs = await fetchActivityLogs();
      setActivityLogs(logs);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (user: AppUser, newRole: UserRole) => {
    try {
      await updateUserRole(user.id, user.email, newRole, currentUserId, currentUserEmail);
      loadUsers();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleStatusChange = async (user: AppUser, newStatus: UserStatus) => {
    try {
      await updateUserStatus(user.id, user.email, newStatus, currentUserId, currentUserEmail);
      loadUsers();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await deleteUserAccount(userToDelete.id, userToDelete.email, currentUserId, currentUserEmail);
      setShowConfirmDelete(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(filterEmail.toLowerCase())
  );

  const statusColors = {
    ACTIVE: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    INACTIVE: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    SUSPENDED: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  };

  const roleColors = {
    ADMIN: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
    USER: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage users and view system activity logs
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6">
          {/* Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('users')}
                className={`py-3 px-1 border-b-2 font-medium transition-colors ${activeTab === 'users'
                  ? 'border-green-600 text-green-600 dark:text-green-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                Users Management
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`py-3 px-1 border-b-2 font-medium transition-colors ${activeTab === 'logs'
                  ? 'border-green-600 text-green-600 dark:text-green-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                Activity Logs
              </button>
            </div>
          </div>

          {/* Add User Button */}
          {activeTab === 'users' && (
            <button
              onClick={() => setShowUserModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-lg hover:shadow-green-500/20"
            >
              <PlusIcon className="w-5 h-5" />
              Add User
            </button>
          )}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            {/* Search Bar */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search by email..."
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Users Table */}
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-400">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-400">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Role
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Created
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Last Login
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-900 dark:text-white">{user.email}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white">{user.name}</td>
                        <td className="py-3 px-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                            className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer border border-slate-300 dark:border-slate-600 ${roleColors[user.role]}`}
                          >
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={user.status}
                            onChange={(e) => handleStatusChange(user, e.target.value as UserStatus)}
                            className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer border border-slate-300 dark:border-slate-600 ${statusColors[user.status]}`}
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="SUSPENDED">Suspended</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => {
                              setUserToDelete(user);
                              setShowConfirmDelete(true);
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                            title="Delete user"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Activity Logs
              </h2>
              <button
                onClick={() => exportActivityLogsAsCSV(activityLogs)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <DownloadIcon className="w-5 h-5" />
                Export CSV
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-400">Loading logs...</p>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-400">No activity logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Timestamp
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        User
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Action
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        Resource
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        IP Address
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white">{log.userEmail}</td>
                        <td className="py-3 px-4">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {log.resourceName || log.resourceType || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {log.ipAddress || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showConfirmDelete && userToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Delete User
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Are you sure you want to delete <strong>{userToDelete.email}</strong>? This action
                cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowConfirmDelete(false);
                    setUserToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showUserModal && (
          <CreateUserModal
            isOpen={showUserModal}
            onClose={() => setShowUserModal(false)}
            onUserCreated={() => {
              loadUsers();
              loadActivityLogs();
            }}
            adminEmail={currentUserEmail}
            adminId={currentUserId}
          />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
