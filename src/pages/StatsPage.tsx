import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Member, Job } from '../types';
import { BarChart3, Users, Loader2, TrendingUp, PieChart } from 'lucide-react';
import { motion } from 'motion/react';

interface StatsPageProps {
  isAdmin?: boolean;
}

export default function StatsPage({ isAdmin = false }: StatsPageProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let membersLoaded = false;
    let jobsLoaded = false;

    const checkLoading = () => {
      if (membersLoaded && jobsLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      setMembers(membersData);
      membersLoaded = true;
      checkLoading();
    });

    const unsubscribeJobs = onSnapshot(collection(db, 'jobs'), (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setJobs(jobsData);
      jobsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubscribeMembers();
      unsubscribeJobs();
    };
  }, []);

  // Calculate stats
  const jobStats = jobs.map(job => {
    const count = members.filter(m => m.job === job.name).length;
    const percentage = members.length > 0 ? (count / members.length) * 100 : 0;
    return {
      ...job,
      count,
      percentage
    };
  }).sort((a, b) => b.count - a.count);

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
        <h1 className="text-3xl font-bold text-white">Member Statistics</h1>
        <p className="text-zinc-500">Overview of guild composition and class distribution</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-orange-500/10 rounded-xl">
              <Users className="w-6 h-6 text-orange-500" />
            </div>
            <h3 className="text-zinc-400 font-medium">Total Members</h3>
          </div>
          <p className="text-4xl font-bold text-white">{members.length}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-zinc-400 font-medium">Active Classes</h3>
          </div>
          <p className="text-4xl font-bold text-white">{jobs.length}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-zinc-400 font-medium">Most Popular</h3>
          </div>
          <p className="text-4xl font-bold text-white truncate">
            {jobStats[0]?.count > 0 ? jobStats[0].name : 'N/A'}
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Class Distribution List */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-orange-500" />
              Class Distribution
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {jobStats.map((stat, index) => (
              <div key={stat.id} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-600 w-6">{(index + 1).toString().padStart(2, '0')}</span>
                    <span className="font-bold text-zinc-200">{stat.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">{stat.count}</span>
                    <span className="text-xs text-zinc-500 ml-1">({stat.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.percentage}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className="h-full bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                  />
                </div>
              </div>
            ))}
            {jobStats.length === 0 && (
              <div className="py-12 text-center text-zinc-500 italic">
                No class data available.
              </div>
            )}
          </div>
        </motion.div>

        {/* Summary Table */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-xl font-bold text-white">Detailed Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-800">
                  <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Class Name</th>
                  <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">Count</th>
                  <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {jobStats.map((stat) => (
                  <tr key={stat.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 font-bold text-zinc-200">{stat.name}</td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 text-white font-bold">
                        {stat.count}
                      </span>
                    </td>
                    <td className="p-4 text-right text-zinc-400 font-mono">
                      {stat.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
