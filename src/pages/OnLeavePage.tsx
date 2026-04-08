import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Search, UserCheck, History, Calendar, AlertCircle } from 'lucide-react';
import { fetchAPI } from '../lib/api';
import { Member, MemberLog } from '../types';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function OnLeavePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberLogs, setSelectedMemberLogs] = useState<MemberLog[]>([]);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedMemberForLogs, setSelectedMemberForLogs] = useState<Member | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAPI('/api/members');
      const membersList = Object.values(data || {}) as Member[];
      setMembers(membersList.filter(m => m.status === 'on-leave'));
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMakeActive = async (member: Member) => {
    try {
      await fetchAPI(`/api/members/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...member,
          status: 'active'
        }),
      });
      loadData();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const loadLogs = async (member: Member) => {
    setSelectedMemberForLogs(member);
    try {
      const logs = await fetchAPI(`/api/logs/${member.id}`);
      setSelectedMemberLogs(logs || []);
      setIsLogsModalOpen(true);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.ign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.job.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [members, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-500" />
            Members on Leave
          </h1>
          <p className="text-zinc-500 mt-1">Manage guild members who are currently taking a break.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search on-leave members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredMembers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredMembers.map((member) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-yellow-500/30 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-yellow-500 transition-colors">{member.ign}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block px-2 py-1 rounded-md bg-zinc-800 text-xs font-medium text-zinc-400">
                        {member.job}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-zinc-500">
                        {member.role || 'DPS'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Status</span>
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium">
                      On Leave
                    </span>
                  </div>
                  {(member as any).returnDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Return Date</span>
                      <span className="text-zinc-300 font-bold">{(member as any).returnDate}</span>
                    </div>
                  )}
                  {(member as any).absentEvent && (
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="text-zinc-500">Missed Event</span>
                      <span className="text-zinc-300 bg-zinc-800/50 px-3 py-1.5 rounded-xl border border-zinc-700/50 text-xs">
                        {(member as any).absentEvent}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => handleMakeActive(member)}
                    className="w-full py-2.5 rounded-xl bg-zinc-800 text-white font-bold hover:bg-green-600 transition-all flex items-center justify-center gap-2 group/btn"
                  >
                    <UserCheck className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                    Mark as Active
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-500">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No members on leave</h3>
          <p className="text-zinc-500 max-w-md mx-auto">
            When members are set to "On Leave" status, they will appear here and be automatically excluded from event assignments.
          </p>
        </div>
      )}

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
                  <AlertCircle className="w-6 h-6" />
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
                      <div className="w-10 h-10 rounded-full bg-zinc-700/50 text-zinc-400 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-white capitalize">{log.type.replace('_', ' ')}</h4>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400 mt-1">{log.details}</p>
                        {log.oldValue && log.newValue && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 line-through">{log.oldValue}</span>
                            <span className="text-zinc-600">→</span>
                            <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{log.newValue}</span>
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
    </div>
  );
}
