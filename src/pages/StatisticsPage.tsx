import { useState, useEffect, useMemo } from 'react';
import { fetchAPI } from '../lib/api';
import { Member, Job } from '../types';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  BarChart3, Users, Briefcase, Loader2, PieChart as PieChartIcon, 
  X, TrendingUp, Calendar, MousePointer2, Activity, ShieldCheck, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#14b8a6', '#6366f1'];
const STATUS_COLORS: Record<string, string> = {
  'active': '#10b981',
  'on-leave': '#f59e0b',
  'left': '#ef4444'
};

interface StatisticsPageProps {
  isAdmin?: boolean;
}

type TabType = 'jobs' | 'status' | 'raffle' | 'traffic';

export default function StatisticsPage({ isAdmin = false }: StatisticsPageProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [selectedJobName, setSelectedJobName] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [membersData, jobsData, analyticsData] = await Promise.all([
          fetchAPI('/api/members'),
          fetchAPI('/api/jobs'),
          fetchAPI('/api/analytics')
        ]);
        setMembers(membersData);
        setJobs(jobsData || []);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error('Failed to load statistics data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    
    // Record page view
    fetchAPI('/api/analytics/page-view', {
      method: 'POST',
      body: JSON.stringify({ page: 'statistics' })
    }).catch(() => {});
  }, []);

  const handleSyncRaffle = async () => {
    setSyncing(true);
    try {
      await fetchAPI('/api/analytics/sync-raffle', { method: 'POST' });
      const analyticsData = await fetchAPI('/api/analytics');
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Failed to sync raffle data:', err);
    } finally {
      setSyncing(false);
    }
  };

  const activeMembers = useMemo(() => members.filter(m => m.status !== 'left'), [members]);

  const jobStats = useMemo(() => {
    const counts: Record<string, number> = {};
    activeMembers.forEach(m => {
      if (m.job) {
        counts[m.job] = (counts[m.job] || 0) + 1;
      }
    });
    return jobs.map(job => ({
      name: job.name,
      count: counts[job.name] || 0
    })).sort((a, b) => b.count - a.count);
  }, [jobs, activeMembers]);

  const statusStats = useMemo(() => {
    const counts: Record<string, number> = {
      'active': 0,
      'on-leave': 0,
      'left': 0
    };
    members.forEach(m => {
      const status = m.status || 'active';
      if (status === 'busy') {
        counts['active'] = (counts['active'] || 0) + 1;
      } else if (counts.hasOwnProperty(status)) {
        counts[status] = (counts[status] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [members]);

  const raffleData = useMemo(() => {
    if (!analytics?.raffleStats) return [];
    return analytics.raffleStats.map((s: any) => ({
      name: `W${s.week} M${s.month}`,
      entries: s.entry_count
    }));
  }, [analytics]);

  const trafficData = useMemo(() => {
    if (!analytics?.pageViews) return [];
    // Group by date
    const groups: Record<string, number> = {};
    analytics.pageViews.forEach((v: any) => {
      // v.timestamp is already a date string from the backend aggregation
      const date = v.timestamp;
      groups[date] = (groups[date] || 0) + (v.count || 1);
    });
    return Object.entries(groups).map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [analytics]);

  const pieData = useMemo(() => jobStats.filter(s => s.count > 0), [jobStats]);
  const totalMembers = activeMembers.length;
  const mostPopularJob = useMemo(() => jobStats[0]?.name || 'None', [jobStats]);

  const handleJobClick = (jobName: string) => {
    setSelectedJobName(jobName);
    setShowModal(true);
  };

  const selectedJobMembers = useMemo(() => activeMembers.filter(m => m.job === selectedJobName), [activeMembers, selectedJobName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'jobs', label: 'Job Classes', icon: Briefcase },
    { id: 'status', label: 'Member Status', icon: Activity },
    { id: 'raffle', label: 'Raffle Analytics', icon: TrendingUp },
    { id: 'traffic', label: 'Traffic', icon: MousePointer2 },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-orange-500" />
          Guild Statistics
        </h1>
        <p className="text-zinc-500">Overview of guild data</p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {(() => {
          const cards = activeTab === 'jobs' ? [
            { label: 'Total Active', value: totalMembers, icon: Users, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { label: 'Total Jobs', value: jobs.length, icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Most Popular', value: mostPopularJob, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' }
          ] : activeTab === 'status' ? [
            { label: 'Total Members', value: members.length, icon: Users, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { label: 'Active', value: members.filter(m => (m.status || 'active') === 'active').length, icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'On Leave', value: members.filter(m => m.status === 'on-leave').length, icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' }
          ] : activeTab === 'raffle' ? [
            { label: 'Raffle Weeks', value: analytics?.raffleStats?.length || 0, icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { label: 'Total Entries', value: analytics?.raffleStats?.reduce((acc: number, s: any) => acc + (s.entryCount || s.entry_count || 0), 0) || 0, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'Avg Entries', value: ((analytics?.raffleStats?.reduce((acc: number, s: any) => acc + (s.entryCount || s.entry_count || 0), 0) || 0) / (analytics?.raffleStats?.length || 1)).toFixed(1), icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' }
          ] : [
            { label: 'Views (30d)', value: analytics?.pageViews?.reduce((acc: number, v: any) => acc + (v.count || 1), 0) || 0, icon: MousePointer2, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { label: 'Unique Pages (30d)', value: new Set(analytics?.pageViews?.map((v: any) => v.page)).size, icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Avg Daily', value: ((analytics?.pageViews?.reduce((acc: number, v: any) => acc + (v.count || 1), 0) || 0) / (trafficData.length || 1)).toFixed(1), icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' }
          ];

          return cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl"
            >
              <div className="flex items-center gap-4 mb-2">
                <div className={cn("p-2 rounded-lg", card.bg)}>
                  <card.icon className={cn("w-5 h-5", card.color)} />
                </div>
                <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">{card.label}</span>
              </div>
              <div className="text-4xl font-bold text-white">{card.value}</div>
            </motion.div>
          ));
        })()}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'jobs' && (
          <motion.div
            key="jobs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
              <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-orange-500" />
                Class Distribution
              </h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={pieData} 
                    layout="vertical" 
                    margin={{ left: 40 }}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        handleJobClick(String(data.activeLabel));
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={12} width={100} />
                    <Tooltip
                      cursor={{ fill: '#27272a', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24} className="cursor-pointer">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-xs text-zinc-500 mt-4 italic">Click a bar to see members</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl overflow-hidden flex flex-col">
              <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                Job Class List
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2">
                {jobStats.filter(s => s.count > 0).map((stat, index) => (
                  <button
                    key={stat.name}
                    onClick={() => handleJobClick(stat.name)}
                    className="w-full flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-800 hover:border-orange-500/30 hover:bg-zinc-800/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-bold text-zinc-200">{stat.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-white">{stat.count}</span>
                      <div className="p-1.5 bg-zinc-800 rounded-lg group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-all">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'status' && (
          <motion.div
            key="status"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
              <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" />
                Member Status Overview
              </h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusStats}
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {statusStats.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={STATUS_COLORS[entry.name] || '#71717a'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
              <h2 className="text-xl font-bold text-white mb-8">Status Breakdown</h2>
              <div className="space-y-4">
                {statusStats.map((stat) => (
                  <div key={stat.name} className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[stat.name] || '#71717a' }} />
                      <span className="font-bold text-zinc-200 uppercase text-xs tracking-widest">{stat.name}</span>
                    </div>
                    <span className="text-xl font-bold text-white">{stat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'raffle' && (
          <motion.div
            key="raffle"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  Weekly Raffle Participation
                </h2>
              </div>
              <div className="h-[400px] w-full">
                {raffleData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={raffleData}>
                      <defs>
                        <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                      <Area type="monotone" dataKey="entries" stroke="#f97316" fillOpacity={1} fill="url(#colorEntries)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-500 italic">
                    <Calendar className="w-12 h-12 mb-4 opacity-20" />
                    No raffle history recorded yet.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'traffic' && (
          <motion.div
            key="traffic"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
              <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                <MousePointer2 className="w-5 h-5 text-orange-500" />
                Public Page Traffic
              </h2>
              <div className="h-[400px] w-full">
                {trafficData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }} />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-500 italic">
                    <Activity className="w-12 h-12 mb-4 opacity-20" />
                    No traffic data recorded yet.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member List Modal */}
      <AnimatePresence>
        {showModal && selectedJobName && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Users className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedJobName}</h2>
                    <p className="text-xs text-zinc-500">{selectedJobMembers.length} Members</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {selectedJobMembers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedJobMembers.map((member) => (
                      <div 
                        key={member.id} 
                        className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-200">{member.ign}</span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{member.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500 italic">
                    No members found for this job.
                  </div>
                )}
              </div>
              <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

