import { useState, useEffect } from 'react';
import { fetchAPI } from '../lib/api';
import { User, Lock, Mail, Trash2, AlertTriangle, Loader2, CheckCircle2, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const data = await fetchAPI('/api/auth/me');
        setUser(data);
        setDisplayName(data.displayName || '');
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    };
    loadUser();
  }, []);

  if (!user) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
    </div>
  );

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchAPI('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ displayName })
      });
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchAPI('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchAPI(`/api/users/${user.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword })
      });
      localStorage.removeItem('token');
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Account Management</h1>
        <p className="text-zinc-500">Manage your personal information and security settings</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl space-y-6"
        >
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-orange-500" />
            Profile Information
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Email Address</label>
              <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-zinc-400">
                <Mail className="w-4 h-4" />
                <span>{user.email}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Display Name</label>
              <input
                required
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Profile'}
            </button>
          </form>
        </motion.div>

        {/* Password Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl space-y-6"
        >
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-500" />
            Change Password
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Current Password</label>
              <input
                required
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">New Password</label>
              <input
                required
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Confirm New Password</label>
              <input
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
            </button>
          </form>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 shadow-xl space-y-6 md:col-span-2"
        >
          <h2 className="text-lg font-bold text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </h2>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-bold">Delete Account</h3>
              <p className="text-zinc-500 text-sm">Once you delete your account, there is no going back. Please be certain.</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
            >
              <Trash2 className="w-5 h-5" />
              Delete Account
            </button>
          </div>
        </motion.div>
      </div>

      {/* Feedback Messages */}
      <AnimatePresence>
        {(success || error) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 z-50"
          >
            {success && (
              <div className="bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-bold">{success}</span>
              </div>
            )}
            {error && (
              <div className="bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
                <AlertTriangle className="w-6 h-6" />
                <span className="font-bold">{error}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Are you absolutely sure?</h2>
                <p className="text-zinc-400">This action cannot be undone. This will permanently delete your account and remove your data from our servers.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Confirm Password</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-red-500/50 outline-none transition-all"
                  placeholder="Enter your password to confirm"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading || !deletePassword}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
