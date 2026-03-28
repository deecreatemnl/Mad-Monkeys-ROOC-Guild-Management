import { useState, useEffect } from 'react';
import { fetchAPI } from '../lib/api';
import { Member, Job } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, Users, Briefcase, Loader2, PieChart as PieChartIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#14b8a6', '#6366f1'];

interface StatisticsPageProps {
  isAdmin?: boolean;
}

export default function StatisticsPage({ isAdmin = false }: StatisticsPageProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobName, setSelectedJobName] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [membersData, jobsData] = await Promise.all([
          fetchAPI('/api/members'),
          fetchAPI('/api/jobs')
        ]);
        setMembers(membersData);
        setJobs(jobsData || []);
      } catch (err) {
        console.error('Failed to load statistics data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const jobStats = jobs.map(job => ({
    name: job.name,
    count: members.filter(m => m.job === job.name).length
  })).sort((a, b) => b.count - a.count);

  const pieData = jobStats.filter(s => s.count > 0);
  const totalMembers = members.length;

  const handleJobClick = (jobName: string) => {
    setSelectedJobName(jobName);
    setShowModal(true);
  };

  const selectedJobMembers = members.filter(m => m.job === selectedJobName);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-orange-500" />
          Job Class Statistics
        </h1>
        <p className="text-zinc-500">Overview of guild composition and class distribution</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Users className="w-5 h-5 text-orange-500" />
            </div>
            <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Total Members</span>
          </div>
          <div className="text-4xl font-bold text-white">{totalMembers}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Active Classes</span>
          </div>
          <div className="text-4xl font-bold text-white">{pieData.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <PieChartIcon className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Most Popular</span>
          </div>
          <div className="text-4xl font-bold text-white truncate">
            {jobStats[0]?.count > 0 ? jobStats[0].name : 'N/A'}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl min-h-[400px]"
        >
          <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-orange-500" />
            Class Distribution
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* List View */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl"
        >
          <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Member Counts by Job
          </h2>
          <div className="space-y-4 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
            {jobStats.map((stat, index) => (
              <button 
                key={stat.name} 
                onClick={() => handleJobClick(stat.name)}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl border border-zinc-800 group hover:border-orange-500/50 hover:bg-zinc-800 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                  />
                  <span className="font-bold text-zinc-200 group-hover:text-white transition-colors">{stat.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-zinc-500 font-mono">
                    {totalMembers > 0 ? ((stat.count / totalMembers) * 100).toFixed(1) : 0}%
                  </div>
                  <div className="bg-zinc-900 px-3 py-1 rounded-lg text-orange-500 font-bold border border-zinc-800 shadow-inner group-hover:border-orange-500/30 transition-colors">
                    {stat.count}
                  </div>
                </div>
              </button>
            ))}
            {jobStats.length === 0 && (
              <div className="text-center py-12 text-zinc-500 italic">
                No jobs defined yet.
              </div>
            )}
          </div>
        </motion.div>
      </div>

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
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
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
                  <div className="space-y-2">
                    {selectedJobMembers.map((member) => (
                      <div 
                        key={member.id} 
                        className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all"
                      >
                        <span className="font-bold text-zinc-200">{member.ign}</span>
                        <span className="text-xs text-zinc-500 font-mono">Joined {member.dateJoined}</span>
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
