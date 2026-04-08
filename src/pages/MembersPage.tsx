import { useState, useEffect } from 'react';
import { fetchAPI } from '../lib/api';
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
  Filter,
  Download,
  Upload,
  History,
  Clock,
  UserCheck,
  UserMinus,
  UserX,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { Member, Job, MemberLog, Role } from '../types';
import { format } from 'date-fns';

interface MembersPageProps {
  isAdmin?: boolean;
}

export default function MembersPage({ isAdmin = false }: MembersPageProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({ 
    ign: '', 
    job: '', 
    role: '', 
    dateJoined: new Date().toISOString().split('T')[0],
    status: 'active' as any
  });
  const [viewMode, setViewMode] = useState<'tile' | 'list'>('list');
  const [selectedJob, setSelectedJob] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedMemberLogs, setSelectedMemberLogs] = useState<MemberLog[]>([]);
  const [selectedMemberForLogs, setSelectedMemberForLogs] = useState<Member | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importIndex, setImportIndex] = useState(0);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
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
      const [membersData, jobsData, rolesData] = await Promise.all([
        fetchAPI('/api/members'),
        fetchAPI('/api/jobs'),
        fetchAPI('/api/roles')
      ]);
      setMembers(membersData);
      setJobs(jobsData);
      setRoles(rolesData);
      
      if (rolesData.length > 0 && !formData.role) {
        setFormData(prev => ({ ...prev, role: rolesData[0].name }));
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (member: Member) => {
    try {
      const logs = await fetchAPI(`/api/members/${member.id}/logs`);
      setSelectedMemberLogs(logs);
      setSelectedMemberForLogs(member);
      setIsLogsModalOpen(true);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const handleExportCSV = () => {
    const headers = ['IGN', 'Job', 'Role', 'Date Joined'];
    const rows = members.map(m => [
      `"${m.ign}"`,
      `"${m.job}"`,
      `"${m.role || 'DPS'}"`,
      `"${m.dateJoined}"`
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `guild_members_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      const parsedData = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((header, i) => {
          if (header === 'IGN') obj.ign = values[i];
          if (header === 'Job') obj.job = values[i];
          if (header === 'Role') obj.role = values[i];
          if (header === 'Date Joined') obj.dateJoined = values[i];
        });
        return obj;
      });

      if (parsedData.length > 0) {
        setImportData(parsedData);
        setImportIndex(0);
        processNextImport(parsedData, 0);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const processNextImport = async (data: any[], index: number) => {
    if (index >= data.length) {
      loadData();
      return;
    }

    const item = data[index];
    const existingMember = members.find(m => m.ign.toLowerCase() === item.ign.toLowerCase());

    if (existingMember) {
      setImportIndex(index);
      setIsOverrideModalOpen(true);
    } else {
      await saveImportedMember(item);
      processNextImport(data, index + 1);
    }
  };

  const saveImportedMember = async (item: any, existingId?: string) => {
    try {
      if (existingId) {
        await fetchAPI(`/api/members/${existingId}`, {
          method: 'PUT',
          body: JSON.stringify(item),
        });
      } else {
        await fetchAPI('/api/members', {
          method: 'POST',
          body: JSON.stringify(item),
        });
      }
    } catch (err) {
      console.error('Import save failed:', err);
    }
  };

  const handleConfirmOverride = async (confirm: boolean) => {
    setIsOverrideModalOpen(false);
    const item = importData[importIndex];
    
    if (confirm) {
      const existingMember = members.find(m => m.ign.toLowerCase() === item.ign.toLowerCase());
      await saveImportedMember(item, existingMember?.id);
    }
    
    processNextImport(importData, importIndex + 1);
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
      setFormData({ 
        ign: member.ign, 
        job: member.job, 
        role: member.role || 'DPS', 
        dateJoined: member.dateJoined,
        status: member.status || 'active'
      });
    } else {
      setEditingMember(null);
      setFormData({ 
        ign: '', 
        job: jobs[0]?.name || '', 
        role: 'DPS', 
        dateJoined: new Date().toISOString().split('T')[0],
        status: 'active'
      });
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
    const matchesStatus = selectedStatus === 'All' || (m.status || 'active') === selectedStatus;
    return matchesSearch && matchesJob && matchesStatus;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let aValue: any = a[sortConfig.key as keyof Member];
    let bValue: any = b[sortConfig.key as keyof Member];

    if (sortConfig.key === 'dateJoined') {
      aValue = new Date(aValue || 0).getTime();
      bValue = new Date(bValue || 0).getTime();
    } else {
      aValue = (aValue || '').toString().toLowerCase();
      bValue = (bValue || '').toString().toLowerCase();
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="w-3 h-3 ml-1 text-orange-500" /> : 
      <ArrowDown className="w-3 h-3 ml-1 text-orange-500" />;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Guild Members</h1>
          <p className="text-zinc-500">Manage your guild roster and classes</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2.5 px-4 rounded-xl transition-all active:scale-95 border border-zinc-700"
              title="Export CSV Template"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <label className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2.5 px-4 rounded-xl transition-all active:scale-95 border border-zinc-700 cursor-pointer">
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Import</span>
              <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
            </label>
            <button
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
            >
              <UserPlus className="w-5 h-5" />
              Add Member
            </button>
          </div>
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
          <div className="relative min-w-[160px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all appearance-none cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="active">Active</option>
              <option value="busy">Busy</option>
              <option value="inactive">Inactive</option>
              <option value="left">Left Guild</option>
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
            {sortedMembers.map((member) => (
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-white group-hover:text-orange-500 transition-colors">{member.ign}</h3>
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        member.status === 'active' ? 'bg-green-500' :
                        member.status === 'busy' ? 'bg-orange-500' :
                        member.status === 'inactive' ? 'bg-zinc-500' : 'bg-red-500'
                      )} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block px-2 py-1 rounded-md bg-zinc-800 text-xs font-medium text-zinc-400">
                        {member.job}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase",
                        member.role === 'Tank' ? 'text-orange-400' : 
                        member.role === 'Support' ? 'text-blue-400' : 
                        member.role === 'Utility' ? 'text-purple-400' : 'text-zinc-500'
                      )}>
                        {member.role || 'DPS'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                    <button
                      onClick={() => loadLogs(member)}
                      className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      title="View Logs"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <>
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
                      </>
                    )}
                  </div>
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
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('ign')}>
                  <div className="flex items-center gap-1">IGN <SortIcon columnKey="ign" /></div>
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1">Status <SortIcon columnKey="status" /></div>
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('job')}>
                  <div className="flex items-center gap-1">Job / Class <SortIcon columnKey="job" /></div>
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('dateJoined')}>
                  <div className="flex items-center gap-1">Date Joined <SortIcon columnKey="dateJoined" /></div>
                </th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {sortedMembers.map((member) => (
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
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          member.status === 'active' ? 'bg-green-500' :
                          member.status === 'busy' ? 'bg-orange-500' :
                          member.status === 'inactive' ? 'bg-zinc-500' : 'bg-red-500'
                        )} />
                        <span className="text-xs text-zinc-400 capitalize">{member.status || 'active'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="px-2 py-1 rounded-md bg-zinc-800 text-xs font-medium text-zinc-400 w-fit">
                          {member.job}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold uppercase mt-1 px-1",
                          member.role === 'Tank' ? 'text-orange-400' : 
                          member.role === 'Support' ? 'text-blue-400' : 
                          member.role === 'Utility' ? 'text-purple-400' : 'text-zinc-500'
                        )}>
                          {member.role || 'DPS'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-zinc-500 font-mono">
                      {member.dateJoined}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                        <button
                          onClick={() => loadLogs(member)}
                          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                          title="View Logs"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
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
                          </>
                        )}
                      </div>
                    </td>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Default Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      {roles.map(role => (
                        <option key={role.id} value={role.name}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      <option value="active">Active</option>
                      <option value="busy">Busy</option>
                      <option value="inactive">Inactive</option>
                      <option value="left">Left Guild</option>
                    </select>
                  </div>
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

      {/* Logs Modal */}
      <AnimatePresence>
        {isLogsModalOpen && selectedMemberForLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Member Activity Logs</h2>
                  <p className="text-zinc-500">History for {selectedMemberForLogs.ign}</p>
                </div>
                <button onClick={() => setIsLogsModalOpen(false)} className="p-2 text-zinc-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {selectedMemberLogs.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 italic">
                    No activity logs found for this member.
                  </div>
                ) : (
                  [...selectedMemberLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log) => (
                    <div key={log.id} className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 flex gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        log.type === 'guild_join' ? 'bg-green-500/10 text-green-500' :
                        log.type === 'guild_leave' ? 'bg-red-500/10 text-red-500' :
                        log.type === 'guild_return' ? 'bg-blue-500/10 text-blue-500' :
                        log.type === 'name_change' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-zinc-700/50 text-zinc-400'
                      )}>
                        {log.type === 'guild_join' ? <UserCheck className="w-5 h-5" /> :
                         log.type === 'guild_leave' ? <UserMinus className="w-5 h-5" /> :
                         log.type === 'guild_return' ? <UserCheck className="w-5 h-5" /> :
                         log.type === 'name_change' ? <Edit2 className="w-5 h-5" /> :
                         <Clock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-white capitalize">{log.type.replace('_', ' ')}</h4>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400 mt-1">{log.details}</p>
                        {(log.oldValue || log.newValue) && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            {log.oldValue && (
                              <span className="text-zinc-500 line-through">{log.oldValue}</span>
                            )}
                            {log.oldValue && log.newValue && (
                              <span className="text-zinc-600">→</span>
                            )}
                            {log.newValue && (
                              <span className="text-orange-400 font-medium">{log.newValue}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Override Confirmation Modal */}
      <AnimatePresence>
        {isOverrideModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Member Already Exists</h2>
              <p className="text-zinc-400 mb-8">
                A member with the name <span className="text-white font-bold">"{importData[importIndex]?.ign}"</span> already exists in the guild. Do you want to override their data?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleConfirmOverride(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-zinc-800 text-zinc-400 font-bold hover:bg-zinc-800 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => handleConfirmOverride(true)}
                  className="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                >
                  Override
                </button>
              </div>
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
