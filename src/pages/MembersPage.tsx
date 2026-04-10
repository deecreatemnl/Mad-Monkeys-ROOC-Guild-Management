import { useState, useEffect, useMemo } from 'react';
import { fetchAPI } from '../lib/api';
import { io } from 'socket.io-client';
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
  Table,
  Columns2,
  BarChart3,
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
  ArrowDown,
  MessageSquare,
  Calendar,
  PieChart,
  Users,
  RefreshCw,
  Activity,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { Member, Job, MemberLog, Role } from '../types';
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

const formatDateForDisplay = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, 'MMMM d, yyyy');
  } catch (e) {
    return dateString;
  }
};

const formatDateForInput = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return format(date, 'yyyy-MM-dd');
  } catch (e) {
    return '';
  }
};

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
    dateJoined: formatDateForDisplay(new Date().toISOString()),
    status: 'active' as any,
    leaveReason: '',
    leaveDates: [] as string[],
    leaveStartedAt: '',
    returnDate: ''
  });
  const [viewMode, setViewMode] = useState<'tile' | 'list' | 'table' | 'grouped' | 'stats'>(() => {
    return (localStorage.getItem('members_view_mode') as any) || 'list';
  });
  const [groupBy, setGroupBy] = useState<'job' | 'role'>(() => {
    return (localStorage.getItem('members_group_by') as any) || 'job';
  });
  const [selectedJob, setSelectedJob] = useState(() => {
    return localStorage.getItem('members_filter_job') || 'All';
  });
  const [selectedStatus, setSelectedStatus] = useState(() => {
    return localStorage.getItem('members_filter_status') || 'All';
  });
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedMemberLogs, setSelectedMemberLogs] = useState<MemberLog[]>([]);
  const [selectedMemberForLogs, setSelectedMemberForLogs] = useState<Member | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importIndex, setImportIndex] = useState(0);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [resolutionData, setResolutionData] = useState<{
    type: 'job' | 'role';
    importedName: string;
    suggestedName: string;
    onResolve: (useExisting: boolean) => void;
  } | null>(null);
  const [statsJobViewMode, setStatsJobViewMode] = useState<'cards' | 'chart'>('cards');
  const [selectedJobForStats, setSelectedJobForStats] = useState<Job | null>(null);
  const [isJobMembersModalOpen, setIsJobMembersModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(() => {
    const saved = localStorage.getItem('members_sort_config');
    return saved ? JSON.parse(saved) : null;
  });
  
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

      // Automatically sync members in background to resolve inconsistencies
      if (isAdmin) {
        fetchAPI('/api/members/sync-roles', { method: 'POST' }).catch(() => {});
        fetchAPI('/api/members/sync-jobs', { method: 'POST' }).catch(() => {});
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
      // Split by comma, but ignore commas inside quotes
      const splitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      const headers = lines[0].split(splitRegex).map(h => h.trim().replace(/^"|"$/g, ''));
      
      const parsedData = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(splitRegex).map(v => v.trim().replace(/^"|"$/g, ''));
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

  const saveImportedMember = async (item: any, existingId?: string, currentRoles: Role[] = roles) => {
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

  const processNextImport = async (data: any[], index: number, currentRoles: Role[] = [...roles]) => {
    if (index >= data.length) {
      // Small delay to ensure DB is updated before fetching
      setTimeout(() => {
        loadData();
        setIsImportModalOpen(false);
      }, 500);
      return;
    }

    const item = { ...data[index] };
    
    // Check Job Similarity
    if (item.job) {
      const lowerJob = item.job.toLowerCase();
      const exactMatch = jobs.find(j => j.name.toLowerCase() === lowerJob);
      
      // If no exact match, look for a substring match (Smart Sync)
      const suggestedJob = exactMatch || jobs.find(j => 
        j.name.toLowerCase().includes(lowerJob) || 
        lowerJob.includes(j.name.toLowerCase())
      );

      if (suggestedJob && suggestedJob.name !== item.job) {
        // Case mismatch or almost similar - Ask user
        setResolutionData({
          type: 'job',
          importedName: item.job,
          suggestedName: suggestedJob.name,
          onResolve: async (useExisting) => {
            if (useExisting) {
              item.job = suggestedJob.name;
            } else {
              // Create new job with exact casing from CSV
              try {
                const newJob = await fetchAPI('/api/jobs', {
                  method: 'POST',
                  body: JSON.stringify({ name: item.job })
                });
                setJobs(prev => [...prev, newJob]);
              } catch (e) { console.error(e); }
            }
            setIsResolutionModalOpen(false);
            // Continue with Role check
            checkRole(item, index, data, currentRoles);
          }
        });
        setIsResolutionModalOpen(true);
        return;
      } else if (!suggestedJob) {
        // No match at all - Create new
        try {
          const newJob = await fetchAPI('/api/jobs', {
            method: 'POST',
            body: JSON.stringify({ name: item.job })
          });
          setJobs(prev => [...prev, newJob]);
          item.job = newJob.name;
        } catch (e) { console.error(e); }
      }
    }

    checkRole(item, index, data, currentRoles);
  };

  const checkRole = async (item: any, index: number, data: any[], currentRoles: Role[]) => {
    if (item.role) {
      const lowerRole = item.role.toLowerCase();
      const exactMatch = currentRoles.find(r => r.name.toLowerCase() === lowerRole);
      
      // If no exact match, look for a substring match (Smart Sync)
      const suggestedRole = exactMatch || currentRoles.find(r => 
        r.name.toLowerCase().includes(lowerRole) || 
        lowerRole.includes(r.name.toLowerCase())
      );

      if (suggestedRole && suggestedRole.name !== item.role) {
        setResolutionData({
          type: 'role',
          importedName: item.role,
          suggestedName: suggestedRole.name,
          onResolve: async (useExisting) => {
            if (useExisting) {
              item.role = suggestedRole.name;
            } else {
              try {
                const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                const newRole = await fetchAPI('/api/roles', {
                  method: 'POST',
                  body: JSON.stringify({ name: item.role, color: randomColor })
                });
                setRoles(prev => [...prev, newRole]);
                currentRoles.push(newRole);
                item.role = newRole.name;
              } catch (e) { console.error(e); }
            }
            setIsResolutionModalOpen(false);
            finalizeImport(item, index, data, currentRoles);
          }
        });
        setIsResolutionModalOpen(true);
        return;
      } else if (!suggestedRole) {
        try {
          const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          const newRole = await fetchAPI('/api/roles', {
            method: 'POST',
            body: JSON.stringify({ name: item.role, color: randomColor })
          });
          setRoles(prev => [...prev, newRole]);
          currentRoles.push(newRole);
          item.role = newRole.name;
        } catch (e) { console.error(e); }
      }
    }

    finalizeImport(item, index, data, currentRoles);
  };

  const finalizeImport = async (item: any, index: number, data: any[], currentRoles: Role[]) => {
    const existingMember = members.find(m => m.ign.toLowerCase() === item.ign.toLowerCase());

    if (existingMember) {
      // Store updated item back to importData for override modal
      const newData = [...data];
      newData[index] = item;
      setImportData(newData);
      setImportIndex(index);
      setIsOverrideModalOpen(true);
    } else {
      await saveImportedMember(item, undefined, currentRoles);
      processNextImport(data, index + 1, currentRoles);
    }
  };

  const handleConfirmOverride = async (confirm: boolean) => {
    setIsOverrideModalOpen(false);
    const item = importData[importIndex];
    const currentRoles = [...roles];
    
    if (confirm) {
      const existingMember = members.find(m => m.ign.toLowerCase() === item.ign.toLowerCase());
      await saveImportedMember(item, existingMember?.id, currentRoles);
    }
    
    processNextImport(importData, importIndex + 1, currentRoles);
  };

  useEffect(() => {
    localStorage.setItem('members_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('members_group_by', groupBy);
  }, [groupBy]);

  useEffect(() => {
    localStorage.setItem('members_filter_job', selectedJob);
  }, [selectedJob]);

  useEffect(() => {
    localStorage.setItem('members_filter_status', selectedStatus);
  }, [selectedStatus]);

  useEffect(() => {
    if (sortConfig) {
      localStorage.setItem('members_sort_config', JSON.stringify(sortConfig));
    } else {
      localStorage.removeItem('members_sort_config');
    }
  }, [sortConfig]);

  useEffect(() => {
    loadData();
    
    const socket = io();
    socket.on('update', (data) => {
      if (data.type === 'members' || data.type === 'jobs' || data.type === 'roles') {
        loadData();
      }
    });

    // Record page view
    fetchAPI('/api/analytics/page-view', {
      method: 'POST',
      body: JSON.stringify({ page: 'members' })
    }).catch(() => {});

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      ign: formData.ign,
      leaveStartedAt: formData.status === 'on-leave' && (!editingMember || editingMember.status !== 'on-leave') 
        ? new Date().toISOString() 
        : (editingMember?.leaveStartedAt || formData.leaveStartedAt)
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
    if (!member && (jobs.length === 0 || roles.length === 0)) {
      setConfirmModal({
        isOpen: true,
        title: 'Setup Required',
        message: 'Please add at least one Job Class and one Job Role in the "Jobs & Roles" page before adding members.',
        onConfirm: () => {
          window.location.hash = '#/jobs';
        }
      });
      return;
    }

    if (member) {
      setEditingMember(member);
      setFormData({ 
        ign: member.ign, 
        job: member.job, 
        role: member.role || 'DPS', 
        dateJoined: member.dateJoined,
        status: member.status || 'active',
        leaveReason: member.leaveReason || '',
        leaveDates: member.leaveDates || [],
        leaveStartedAt: member.leaveStartedAt || '',
        returnDate: member.returnDate || ''
      });
    } else {
      setEditingMember(null);
      setFormData({ 
        ign: '', 
        job: jobs[0]?.name || '', 
        role: 'DPS', 
        dateJoined: formatDateForDisplay(new Date().toISOString()),
        status: 'active',
        leaveReason: '',
        leaveDates: [],
        leaveStartedAt: '',
        returnDate: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
    setFormData({
      ign: '',
      job: jobs[0]?.name || '',
      role: 'DPS',
      dateJoined: formatDateForDisplay(new Date().toISOString()),
      status: 'active',
      leaveReason: '',
      leaveDates: [],
      leaveStartedAt: '',
      returnDate: ''
    });
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const ign = m.ign || '';
      const job = m.job || '';
      const matchesSearch = ign.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           job.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesJob = selectedJob === 'All' || m.job === selectedJob;
      const matchesStatus = selectedStatus === 'All' || (m.status || 'active') === selectedStatus;
      return matchesSearch && matchesJob && matchesStatus;
    });
  }, [members, searchTerm, selectedJob, selectedStatus]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      // Always put 'left the guild' at the bottom
      const aLeft = (a.status || 'active') === 'left the guild';
      const bLeft = (b.status || 'active') === 'left the guild';
      if (aLeft && !bLeft) return 1;
      if (!aLeft && bLeft) return -1;

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
  }, [filteredMembers, sortConfig]);

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
              <option value="on-leave">On Leave</option>
              <option value="left the guild">Left Guild</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="List View"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('tile')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'tile' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Card View"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'table' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Compact Table"
            >
              <Table className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'grouped' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Grouped View"
            >
              <Columns2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'stats' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Statistics"
            >
              <BarChart3 className="w-5 h-5" />
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
                        member.status === 'on-leave' ? 'bg-orange-500' : 'bg-red-500'
                      )} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const jobObj = jobs.find(j => j.name === member.job);
                        return (
                          <span 
                            className="inline-block px-2 py-1 rounded-md text-xs font-medium"
                            style={{ 
                              backgroundColor: jobObj?.color ? `${jobObj.color}15` : '#27272a',
                              color: jobObj?.color || '#a1a1aa',
                              border: jobObj?.color ? `1px solid ${jobObj.color}30` : '1px solid #3f3f46'
                            }}
                          >
                            {member.job}
                          </span>
                        );
                      })()}
                      {(() => {
                        const roleObj = roles.find(r => r.name === (member.role || 'DPS'));
                        return (
                          <span 
                            className="text-[10px] font-bold uppercase"
                            style={{ color: roleObj?.color || '#71717a' }}
                          >
                            {member.role || 'DPS'}
                          </span>
                        );
                      })()}
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
      ) : viewMode === 'table' ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('ign')}>
                  <div className="flex items-center gap-1">IGN <SortIcon columnKey="ign" /></div>
                </th>
                <th className="p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1">Status <SortIcon columnKey="status" /></div>
                </th>
                <th className="p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('job')}>
                  <div className="flex items-center gap-1">Job <SortIcon columnKey="job" /></div>
                </th>
                <th className="p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('role')}>
                  <div className="flex items-center gap-1">Role <SortIcon columnKey="role" /></div>
                </th>
                <th className="p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => handleSort('dateJoined')}>
                  <div className="flex items-center gap-1">Joined <SortIcon columnKey="dateJoined" /></div>
                </th>
                <th className="p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((member) => (
                <tr key={member.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
                  <td className="p-3 text-sm font-bold text-white">{member.ign}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        member.status === 'active' ? 'bg-green-500' :
                        member.status === 'on-leave' ? 'bg-orange-500' : 'bg-red-500'
                      )} />
                      <span className="text-[10px] text-zinc-400 uppercase">{member.status || 'active'}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-zinc-300">{member.job}</span>
                  </td>
                  <td className="p-3">
                    {(() => {
                      const roleObj = roles.find(r => r.name === (member.role || 'DPS'));
                      return (
                        <span className="text-[10px] font-bold uppercase" style={{ color: roleObj?.color || '#71717a' }}>
                          {member.role || 'DPS'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-xs text-zinc-500 font-mono">{member.dateJoined}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => loadLogs(member)} className="p-1.5 text-zinc-400 hover:text-white rounded-md"><History className="w-3.5 h-3.5" /></button>
                      {isAdmin && (
                        <>
                          <button onClick={() => openModal(member)} className="p-1.5 text-zinc-400 hover:text-white rounded-md"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(member.id!)} className="p-1.5 text-zinc-400 hover:text-red-500 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-8">
          <div className="flex justify-center">
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setGroupBy('job')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                  groupBy === 'job' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-400"
                )}
              >
                Group by Job
              </button>
              <button
                onClick={() => setGroupBy('role')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                  groupBy === 'role' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-400"
                )}
              >
                Group by Role
              </button>
            </div>
          </div>
          
          {(() => {
            const groups: Record<string, Member[]> = {};
            sortedMembers.forEach(m => {
              const key = groupBy === 'job' ? m.job : (m.role || 'DPS');
              if (!groups[key]) groups[key] = [];
              groups[key].push(m);
            });
            
            return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, groupMembers]) => {
              // Sort group members to put 'left the guild' at the bottom
              const sortedGroupMembers = [...groupMembers].sort((a, b) => {
                const aLeft = (a.status || 'active') === 'left the guild';
                const bLeft = (b.status || 'active') === 'left the guild';
                if (aLeft && !bLeft) return 1;
                if (!aLeft && bLeft) return -1;
                return a.ign.localeCompare(b.ign);
              });

              return (
                <div key={groupName} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {groupBy === 'job' ? (
                        <div className="w-2 h-6 bg-orange-500 rounded-full" />
                      ) : (
                        <div 
                          className="w-2 h-6 rounded-full" 
                          style={{ backgroundColor: roles.find(r => r.name === groupName)?.color || '#52525b' }}
                        />
                      )}
                      {groupName}
                      <span className="text-sm font-normal text-zinc-500 ml-2">({groupMembers.length})</span>
                    </h3>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {sortedGroupMembers.map(member => (
                      <div key={member.id} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex justify-between items-center group">
                        <div>
                          <div className="font-bold text-zinc-200 text-sm">{member.ign}</div>
                          <div className="text-[10px] text-zinc-500 uppercase">{member.status || 'active'}</div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(member)} className="p-1 text-zinc-500 hover:text-white"><Edit2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : viewMode === 'stats' ? (
        <div className="space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Total Members</div>
              <div className="text-2xl font-bold text-white">{members.length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Active</div>
              <div className="text-2xl font-bold text-green-500">{members.filter(m => (m.status || 'active') === 'active').length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">On Leave</div>
              <div className="text-2xl font-bold text-orange-500">{members.filter(m => m.status === 'on-leave').length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Members who left the guild</div>
              <div className="text-2xl font-bold text-red-500">{members.filter(m => m.status === 'left the guild').length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Total Jobs</div>
              <div className="text-2xl font-bold text-blue-500">{jobs.length}</div>
            </div>
          </div>

          {/* Job Class List - From Screenshot */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                Job Class List
              </h3>
              <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-lg">
                <button 
                  onClick={() => setStatsJobViewMode('cards')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    statsJobViewMode === 'cards' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setStatsJobViewMode('chart')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    statsJobViewMode === 'chart' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {statsJobViewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobs.map((job, index) => {
                  const jobMembers = members.filter(m => m.job === job.name && (m.status || 'active') !== 'left the guild');
                  const count = jobMembers.length;
                  const colors = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#14b8a6', '#6366f1'];
                  const color = job.color || colors[index % colors.length];
                  
                  const activeTotal = members.filter(m => (m.status || 'active') !== 'left the guild').length;
                  
                  return (
                    <button 
                      key={job.id} 
                      onClick={() => {
                        setSelectedJobForStats(job);
                        setIsJobMembersModalOpen(true);
                      }}
                      className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-xl flex items-center justify-between group hover:border-zinc-700 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-bold text-zinc-200">{job.name}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-white">{count}</span>
                          <Users className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500">
                          {activeTotal > 0 ? Math.round((count / activeTotal) * 100) : 0}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={jobs.map((job, index) => {
                      const count = members.filter(m => m.job === job.name && (m.status || 'active') !== 'left the guild').length;
                      const colors = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#14b8a6', '#6366f1'];
                      return {
                        name: job.name,
                        count,
                        color: job.color || colors[index % colors.length]
                      };
                    }).sort((a, b) => b.count - a.count)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" stroke="#71717a" fontSize={12} />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={12} width={100} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {jobs.map((entry, index) => {
                        const colors = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#14b8a6', '#6366f1'];
                        return <Cell key={`cell-${index}`} fill={entry.color || colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-orange-500" />
                Role Distribution
              </h3>
              <div className="space-y-4">
                {roles.map(role => {
                  const count = members.filter(m => (m.role || 'DPS') === role.name).length;
                  const percentage = members.length > 0 ? (count / members.length) * 100 : 0;
                  return (
                    <div key={role.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400 font-bold uppercase tracking-wider">{role.name}</span>
                        <span className="text-zinc-200 font-bold">{count} ({Math.round(percentage)}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className="h-full"
                          style={{ backgroundColor: role.color || '#3b82f6' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" />
                Status Distribution
              </h3>
              <div className="space-y-4">
                {['active', 'on-leave', 'left the guild'].map(status => {
                  const count = members.filter(m => (m.status || 'active') === status).length;
                  const percentage = members.length > 0 ? (count / members.length) * 100 : 0;
                  const colors: Record<string, string> = {
                    'active': '#22c55e',
                    'on-leave': '#f97316',
                    'left the guild': '#ef4444'
                  };
                  return (
                    <div key={status} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400 font-bold uppercase tracking-wider">{status}</span>
                        <span className="text-zinc-200 font-bold">{count} ({Math.round(percentage)}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className="h-full"
                          style={{ backgroundColor: colors[status] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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
                          member.status === 'busy' ? 'bg-orange-500' : 'bg-red-500'
                        )} />
                        <span className="text-xs text-zinc-400 capitalize">{member.status || 'active'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {(() => {
                          const jobObj = jobs.find(j => j.name === member.job);
                          return (
                            <span 
                              className="px-2 py-1 rounded-md text-xs font-medium w-fit"
                              style={{ 
                                backgroundColor: jobObj?.color ? `${jobObj.color}15` : '#27272a',
                                color: jobObj?.color || '#a1a1aa',
                                border: jobObj?.color ? `1px solid ${jobObj.color}30` : '1px solid #3f3f46'
                              }}
                            >
                              {member.job}
                            </span>
                          );
                        })()}
                        {(() => {
                          const roleObj = roles.find(r => r.name === (member.role || 'DPS'));
                          return (
                            <span 
                              className="text-[10px] font-bold uppercase px-1"
                              style={{ color: roleObj?.color || '#71717a' }}
                            >
                              {member.role || 'DPS'}
                            </span>
                          );
                        })()}
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
              className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6"
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
                    placeholder="Member Name"
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
                      <option value="on-leave">On Leave</option>
                      <option value="left the guild">Left Guild</option>
                    </select>
                  </div>
                </div>

                {formData.status === 'on-leave' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    {editingMember?.status === 'on-leave' ? (
                      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <MessageSquare className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-0.5">Leave Reason</label>
                            <p className="text-sm text-zinc-200">{formData.leaveReason || 'No reason provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-0.5">Leave Dates</label>
                            <p className="text-sm text-zinc-200">{formData.leaveDates?.join(', ') || 'No dates provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Clock className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-0.5">Expected Return</label>
                            <p className="text-sm text-zinc-200">{formData.returnDate || 'No return date set'}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1.5">Leave Reason</label>
                          <textarea
                            value={formData.leaveReason}
                            onChange={(e) => setFormData({ ...formData, leaveReason: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 h-20 resize-none"
                            placeholder="Reason for leave..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1.5">Leave Dates (comma separated)</label>
                          <input
                            type="text"
                            value={formData.leaveDates?.join(', ') || ''}
                            onChange={(e) => setFormData({ ...formData, leaveDates: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            placeholder="e.g. Thu, Apr 9, Fri, Apr 10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1.5">Expected Return Date</label>
                          <input
                            type="date"
                            value={formatDateForInput(formData.returnDate)}
                            onChange={(e) => setFormData({ ...formData, returnDate: formatDateForDisplay(e.target.value) })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Date Joined</label>
                  <input
                    required
                    type="date"
                    value={formatDateForInput(formData.dateJoined)}
                    onChange={(e) => setFormData({ ...formData, dateJoined: formatDateForDisplay(e.target.value) })}
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

      {/* Import Resolution Modal */}
      <AnimatePresence>
        {isResolutionModalOpen && resolutionData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8"
            >
              <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 text-center">Similar {resolutionData.type === 'job' ? 'Job' : 'Role'} Found</h2>
              <p className="text-zinc-400 mb-6 text-center">
                The imported {resolutionData.type} <span className="text-white font-bold">"{resolutionData.importedName}"</span> is similar to an existing one.
              </p>

              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-8">
                <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Existing {resolutionData.type === 'job' ? 'Job' : 'Role'}</div>
                <div className="flex items-center gap-3">
                  {resolutionData.type === 'role' && (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: roles.find(r => r.name === resolutionData.suggestedName)?.color || '#52525b' }} 
                    />
                  )}
                  <span className="text-lg font-bold text-white">{resolutionData.suggestedName}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => resolutionData.onResolve(true)}
                  className="w-full px-4 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                >
                  Use Existing "{resolutionData.suggestedName}"
                </button>
                <button
                  onClick={() => resolutionData.onResolve(false)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 text-zinc-400 font-bold hover:bg-zinc-800 transition-colors"
                >
                  Create New "{resolutionData.importedName}"
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Job Members Modal */}
      <AnimatePresence>
        {isJobMembersModalOpen && selectedJobForStats && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsJobMembersModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-3 h-12 rounded-full" 
                    style={{ backgroundColor: selectedJobForStats.color || '#f97316' }} 
                  />
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedJobForStats.name}</h2>
                    <p className="text-sm text-zinc-500">
                      {members.filter(m => m.job === selectedJobForStats.name && m.status !== 'left the guild').length} Members
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsJobMembersModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {members
                    .filter(m => m.job === selectedJobForStats.name && m.status !== 'left the guild')
                    .sort((a, b) => a.ign.localeCompare(b.ign))
                    .map(member => (
                      <div 
                        key={member.id}
                        className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between group hover:border-zinc-700 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            (member.status || 'active') === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                            member.status === 'on-leave' ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" :
                            "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                          )} />
                          <div>
                            <div className="font-bold text-zinc-100">{member.ign}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                              {member.role || 'DPS'} • {member.status || 'active'}
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setIsJobMembersModalOpen(false);
                              openModal(member);
                            }}
                            className="p-2 text-zinc-600 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
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
