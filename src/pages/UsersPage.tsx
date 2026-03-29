import { useState, useEffect, useCallback } from 'react';
import { fetchAPI } from '../lib/api';
import { UserProfile } from '../types';
import { Shield, ShieldAlert, Search, UserCheck, UserX, UserPlus, X, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';

export default function UsersPage({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [addFormData, setAddFormData] = useState({ username: '', role: 'user' as 'admin' | 'user' | 'member', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAddFormData(prev => ({ ...prev, password }));
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadUsers = useCallback(async () => {
    try {
      const usersData = await fetchAPI('/api/users');
      setUsers(usersData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load users:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetchAPI('/api/admins/create', {
        method: 'POST',
        body: JSON.stringify({
          ...addFormData,
          username: addFormData.username
        }),
      });

      setIsAddModalOpen(false);
      setAddFormData({ username: '', role: 'user', password: '' });
      loadUsers();
      alert('User authorized successfully!');
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAdmin = async (user: UserProfile) => {
    if (!isSuperAdmin) return;
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    
    // Optimistic update
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));

    try {
      await fetchAPI(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });
      loadUsers();
    } catch (error) {
      console.error('Failed to update user role:', error);
      loadUsers(); // Rollback
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    const canDelete = isSuperAdmin || (user.role === 'user');
    if (!canDelete) {
      alert('You do not have permission to delete this user.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.displayName}? This action cannot be undone.`,
      onConfirm: async () => {
        // Optimistic update
        setUsers(prev => prev.filter(u => u.id !== user.id));
        
        try {
          await fetchAPI(`/api/users/${user.id}`, {
            method: 'DELETE'
          });
          loadUsers();
        } catch (error) {
          console.error('Failed to delete user:', error);
          loadUsers(); // Rollback
        }
      }
    });
  };

  const filteredUsers = users.filter(user => 
    (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-500" />
            Manage Users
          </h1>
          <p className="text-zinc-400 mt-1">Manage guild members and administrators.</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
            >
              <UserPlus className="w-5 h-5" />
              Add User
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 italic">No users found matching your search.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredUsers.map((user) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    user.role === 'superadmin' ? "bg-orange-500/10 text-orange-500" :
                    user.role === 'admin' ? "bg-blue-500/10 text-blue-500" : "bg-zinc-800 text-zinc-500"
                  )}>
                    {user.role === 'superadmin' ? <ShieldAlert className="w-5 h-5" /> : 
                     user.role === 'admin' ? <Shield className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-zinc-100">{user.displayName}</h3>
                      {((user as any).isPreAuthorized) && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-700 uppercase font-bold tracking-wider">Pending</span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 font-mono">{user.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border",
                    user.role === 'superadmin' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                    user.role === 'admin' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700"
                  )}>
                    {user.role}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    {isSuperAdmin && user.role !== 'superadmin' && (
                      <button
                        onClick={() => toggleAdmin(user)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          user.role === 'admin' 
                            ? "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700" 
                            : "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                        )}
                        title={user.role === 'admin' ? "Demote to User" : "Promote to Admin"}
                      >
                        {user.role === 'admin' ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                      </button>
                    )}

                    {(isSuperAdmin || (user.role === 'user')) && user.role !== 'superadmin' && (
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Add User</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-zinc-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">IGN (Username)</label>
                  <input
                    required
                    type="text"
                    value={addFormData.username}
                    onChange={(e) => setAddFormData({ ...addFormData, username: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="e.g. PlayerName"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">User Role</label>
                  <select
                    value={addFormData.role}
                    onChange={(e) => setAddFormData({ ...addFormData, role: e.target.value as 'admin' | 'user' | 'member' })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                  >
                    <option value="user">Guild User (User)</option>
                    <option value="admin">Guild Admin (Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addFormData.password}
                      onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Min 6 chars for password login"
                    />
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="px-3 py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                      title="Generate Password"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">If provided (min 6 chars), the user can log in with this password.</p>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Authorizing...' : 'Authorize User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}
