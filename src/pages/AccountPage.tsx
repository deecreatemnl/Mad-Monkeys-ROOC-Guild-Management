import { useState } from 'react';
import { motion } from 'motion/react';
import { User, Lock, Trash2, AlertTriangle, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { fetchAPI } from '../firebase';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface AccountPageProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
  onLogout: () => void;
}

export default function AccountPage({ user, onUpdateUser, onLogout }: AccountPageProps) {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await fetchAPI('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          username: user.username,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      setMessage({ type: 'success', text: 'Password updated successfully' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (user.role === 'superadmin') return;

    setLoading(true);
    try {
      await fetchAPI(`/api/users/${user.username}`, {
        method: 'DELETE'
      });
      onLogout();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete account' });
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase italic">Account Management</h1>
            <p className="text-zinc-500">Manage your profile and security settings</p>
          </div>
        </div>
      </header>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl border flex items-center gap-3",
            message.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"
          )}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Info */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            Profile Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">IGN (Username)</label>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-zinc-400 font-medium">
                {user.username}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Display Name</label>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-zinc-400 font-medium">
                {user.displayName}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Role</label>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold uppercase tracking-widest">
                {user.role}
              </div>
            </div>
          </div>
        </section>

        {/* Change Password */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-500" />
            Security
          </h2>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Current Password</label>
              <input
                type="password"
                required
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">New Password</label>
              <input
                type="password"
                required
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Confirm New Password</label>
              <input
                type="password"
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>
      </div>

      {/* Danger Zone */}
      {user.role !== 'superadmin' && (
        <section className="bg-red-500/5 border border-red-500/10 rounded-3xl p-8 space-y-6">
          <div className="flex items-center gap-3 text-red-500">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase italic">Danger Zone</h2>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-zinc-200">Delete Account</h3>
              <p className="text-sm text-zinc-500">Once you delete your account, there is no going back. Please be certain.</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 font-bold px-6 py-3 rounded-xl transition-all"
            >
              Delete Account
            </button>
          </div>
        </section>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full space-y-6"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black uppercase italic">Are you sure?</h3>
              <p className="text-zinc-500">This action cannot be undone. All your data will be permanently removed.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20"
              >
                {loading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
