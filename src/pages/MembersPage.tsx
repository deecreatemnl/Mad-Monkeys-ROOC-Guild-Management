import { useState, useEffect } from 'react';
import { fetchAPI } from '../lib/api';
import { Member, Job } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Search, 
  UserPlus, 
  LayoutGrid, 
  List,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';

interface MembersPageProps {
  isAdmin?: boolean;
}

export default function MembersPage({ isAdmin = false }: MembersPageProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({ ign: '', job: '', dateJoined: new Date().toISOString().split('T')[0] });
  const [viewMode, setViewMode] = useState<'tile' | 'list'>('list');
  const [selectedJob, setSelectedJob] = useState('All');
  
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersData, jobsData] = await Promise.all([
        fetchAPI('/api/members'),
        fetchAPI('/api/jobs')
      ]);
      setMembers(membersData);
      setJobs(jobsData);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      ign: formData.ign
    };

    // Optimistic update
    const tempId = 'temp-' + Date.now();
    const optimisticMember = { ...payload, id: editingMember?.id || tempId };
    
    if (editingMember) {
      setMembers(prev => prev.map(m => m.id === editingMember.id ? optimisticMember : m));
    } else {
      setMembers(prev => [...prev, optimisticMember]);
    }
    
    closeModal();

    try {
      if (editingMember) {
        await fetchAPI(`/api/members/${editingMember.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await fetchAPI('/api/members', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      loadData();
    } catch (error) {
      console.error('Save failed:', error);
      loadData(); // Rollback
    }
  };

  const handleDelete = async (id: number | string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Member',
      message: 'Are you sure you want to delete this member? This action cannot be undone.',
      onConfirm: async () => {
        // Optimistic update
        setMembers(prev => prev.filter(m => m.id !== id));
        
        try {
          await fetchAPI(`/api/members/${id}`, { method: 'DELETE' });
          loadData();
        } catch (error) {
          console.error('Delete failed:', error);
          loadData(); // Rollback
        }
      }
    });
  };

  const openModal = (member?: Member) => {
    if (member) {
      setEditingMember(member);
      setFormData({ ign: member.ign, job: member.job, dateJoined: member.dateJoined });
    } else {
      setEditingMember(null);
      setFormData({ ign: '', job: jobs[0]?.name || '', dateJoined: new Date().toISOString().split('T')[0] });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
  };

  const filteredMembers = members.filter(m => {
    const ign = m.ign || '';
    const job = m.job || '';
    const matchesSearch = ign.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesJob = selectedJob === 'All' || m.job === selectedJob;
    return matchesSearch && matchesJob;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Guild Members</h1>
          <p className="text-zinc-500">Manage your guild roster and classes</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
          >
            <UserPlus className="w-5 h-5" />
            Add Member
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row flex-1 gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by IGN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            />
          </div>
          <div className="relative min-w-[160px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all appearance-none cursor-pointer"
            >
              <option value="All">All Classes</option>
              {jobs.map(job => (
                <option key={job.id} value={job.name}>{job.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('tile')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'tile' ? "bg-zinc-800 text-orange-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Tile View"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-zinc-800 text-orange-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="List View"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : viewMode === 'tile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredMembers.map((member) => (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-orange-500 transition-colors">{member.ign}</h3>
                    <span className="inline-block px-2 py-1 rounded-md bg-zinc-800 text-xs font-medium text-zinc-400 mt-1">
                      {member.job}
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openModal(member)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id!)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm text-zinc-500">
                  <span>Joined</span>
                  <span className="font-mono">{member.dateJoined}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">IGN</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Job / Class</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Date Joined</th>
                {isAdmin && <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filteredMembers.map((member) => (
                  <motion.tr
                    key={member.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group"
                  >
                    <td className="p-4">
                      <span className="font-bold text-white group-hover:text-orange-500 transition-colors">{member.ign}</span>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-md bg-zinc-800 text-xs font-medium text-zinc-400">
                        {member.job}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-zinc-500 font-mono">
                      {member.dateJoined}
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openModal(member)}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(member.id!)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <div className="p-12 text-center text-zinc-500 italic">
              No members found matching your search.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
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
                  {editingMember ? 'Edit Member' : 'Add New Member'}
                </h2>
                <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">In-Game Name (IGN)</label>
                  <input
                    required
                    type="text"
                    value={formData.ign}
                    onChange={(e) => setFormData({ ...formData, ign: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    placeholder="e.g. MadMonkeyBoss"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Job / Class</label>
                  <select
                    value={formData.job}
                    onChange={(e) => setFormData({ ...formData, job: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  >
                    {jobs.map(job => (
                      <option key={job.id} value={job.name}>{job.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Date Joined</label>
                  <input
                    required
                    type="date"
                    value={formData.dateJoined}
                    onChange={(e) => setFormData({ ...formData, dateJoined: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div className="pt-4 flex gap-3">
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
                    {editingMember ? 'Save Changes' : 'Add Member'}
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
