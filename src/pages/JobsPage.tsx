import { useState, useEffect, useCallback } from 'react';
import { fetchAPI } from '../lib/api';
import { Job, Role } from '../types';
import { Plus, Edit2, Trash2, X, Check, Briefcase, Shield, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';

interface JobsPageProps {
  isAdmin?: boolean;
}

export default function JobsPage({ isAdmin = false }: JobsPageProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Job Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState({ 
    name: ''
  });

  // Role Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({ 
    name: '',
    color: '#a1a1aa'
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  
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

  const loadData = useCallback(async () => {
    try {
      const [jobsData, rolesData] = await Promise.all([
        fetchAPI('/api/jobs'),
        fetchAPI('/api/roles')
      ]);
      setJobs(jobsData);
      setRoles(rolesData);
      setLoading(false);
      
      // Automatically sync members in background when roles/jobs change
      fetchAPI('/api/members/sync-roles', { method: 'POST' }).catch(() => {});
      fetchAPI('/api/members/sync-jobs', { method: 'POST' }).catch(() => {});
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncJobs = async () => {
    setIsSyncing(true);
    try {
      const result = await fetchAPI('/api/members/sync-jobs', { method: 'POST' });
      alert(`Successfully synced ${result.synced} members to official job names.`);
      loadData();
    } catch (error) {
      console.error('Failed to sync jobs:', error);
      alert('Failed to sync jobs. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncRoles = async () => {
    setIsSyncing(true);
    try {
      const result = await fetchAPI('/api/members/sync-roles', { method: 'POST' });
      alert(`Successfully synced ${result.synced} members to official role names.`);
      loadData();
    } catch (error) {
      console.error('Failed to sync roles:', error);
      alert('Failed to sync roles. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingJob) {
        await fetchAPI(`/api/jobs/${editingJob.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await fetchAPI('/api/jobs', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      loadData();
      closeModal();
    } catch (error) {
      console.error('Failed to save job:', error);
    }
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await fetchAPI(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify(roleFormData)
        });
      } else {
        await fetchAPI('/api/roles', {
          method: 'POST',
          body: JSON.stringify(roleFormData)
        });
      }
      loadData();
      closeRoleModal();
    } catch (error) {
      console.error('Failed to save role:', error);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Job',
      message: 'Are you sure you want to delete this job? This may affect members assigned to this job.',
      onConfirm: async () => {
        try {
          await fetchAPI(`/api/jobs/${id}`, {
            method: 'DELETE'
          });
          loadData();
        } catch (error) {
          console.error('Failed to delete job:', error);
        }
      }
    });
  };

  const handleRoleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Role',
      message: 'Are you sure you want to delete this role? This may affect members and assignments using this role.',
      onConfirm: async () => {
        try {
          await fetchAPI(`/api/roles/${id}`, {
            method: 'DELETE'
          });
          loadData();
        } catch (error) {
          console.error('Failed to delete role:', error);
        }
      }
    });
  };

  const openModal = (job?: Job) => {
    if (job) {
      setEditingJob(job);
      setFormData({ 
        name: job.name || ''
      });
    } else {
      setEditingJob(null);
      setFormData({ 
        name: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingJob(null);
  };

  const openRoleModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleFormData({ 
        name: role.name || '',
        color: role.color || '#a1a1aa'
      });
    } else {
      setEditingRole(null);
      setRoleFormData({ 
        name: '',
        color: '#a1a1aa'
      });
    }
    setIsRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    setIsRoleModalOpen(false);
    setEditingRole(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-orange-500" />
            Manage Jobs / Classes
          </h1>
          <p className="text-zinc-500">Update the list of classes available for guild members</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-5 h-5" />
            Add Job
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {jobs.map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl hover:border-zinc-700 transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white group-hover:text-orange-500 transition-colors">{job.name}</span>
                </div>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                  <button
                    onClick={() => openModal(job)}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(job.id!)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {jobs.length === 0 && (
            <div className="col-span-full py-12 text-center border border-dashed border-zinc-800 rounded-xl">
              <p className="text-zinc-500 italic">No jobs added yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Roles Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-16 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-500" />
            Manage Roles
          </h2>
          <p className="text-zinc-500">Update the list of roles available for assignments</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openRoleModal()}
            className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-5 h-5" />
            Add Role
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {roles.map((role) => (
              <motion.div
                key={role.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl hover:border-zinc-700 transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }} />
                  <span className="font-bold text-white group-hover:text-blue-500 transition-colors">{role.name}</span>
                </div>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                  <button
                    onClick={() => openRoleModal(role)}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRoleDelete(role.id!)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {roles.length === 0 && (
            <div className="col-span-full py-12 text-center border border-dashed border-zinc-800 rounded-xl">
              <p className="text-zinc-500 italic">No roles added yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Job Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingJob ? 'Edit Job' : 'Add New Job'}
                </h2>
                <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Job / Class Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    placeholder="e.g. Lord Knight"
                  />
                </div>

                <div className="pt-4 flex gap-3 sticky bottom-0 bg-zinc-900 pb-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                  >
                    {editingJob ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Role Modal */}
      <AnimatePresence>
        {isRoleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeRoleModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingRole ? 'Edit Role' : 'Add New Role'}
                </h2>
                <button onClick={closeRoleModal} className="p-2 text-zinc-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleRoleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Role Name</label>
                  <input
                    required
                    type="text"
                    value={roleFormData.name}
                    onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="e.g. DPS"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Role Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={roleFormData.color}
                      onChange={(e) => setRoleFormData({ ...roleFormData, color: e.target.value })}
                      className="w-12 h-12 rounded-xl cursor-pointer bg-zinc-800 border border-zinc-700 p-1"
                    />
                    <input
                      type="text"
                      value={roleFormData.color}
                      onChange={(e) => setRoleFormData({ ...roleFormData, color: e.target.value })}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 uppercase"
                      pattern="^#[0-9A-Fa-f]{6}$"
                      placeholder="#000000"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3 sticky bottom-0 bg-zinc-900 pb-2">
                  <button
                    type="button"
                    onClick={closeRoleModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                  >
                    {editingRole ? 'Update' : 'Create'}
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
