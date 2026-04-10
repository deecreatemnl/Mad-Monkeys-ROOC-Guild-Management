import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Search, UserCheck, History, Calendar, AlertCircle, MessageSquare } from 'lucide-react';
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
      const membersList = Array.isArray(data) ? data : Object.values(data || {}) as Member[];
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
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredMembers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredMembers.map((member) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl relative group hover:border-orange-500/30 transition-all shadow-xl"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-xl border border-orange-500/20">
                    {member.ign.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-100 text-lg truncate">{member.ign}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        {member.job}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        {member.role || 'DPS'}
                      </span>
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                    On Leave
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 relative">
                    <MessageSquare className="absolute -top-2 -left-2 w-4 h-4 text-zinc-700" />
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm text-zinc-400 italic leading-relaxed">
                        "{member.leaveReason || 'On Leave (Admin Set)'}"
                      </p>
                    </div>
                    {member.absentEvent && (
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase mt-2">
                        <AlertCircle className="w-3 h-3 text-orange-500/50" />
                        Reported for: <span className="text-zinc-400">{member.absentEvent}</span>
                      </div>
                    )}
                  </div>

                  {member.leaveDates && member.leaveDates.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {member.leaveDates.map(date => (
                        <span key={date} className="text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-700/50">
                          {date}
                        </span>
                      ))}
                    </div>
                  )}

                  {member.returnDate && (
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest pt-2 border-t border-zinc-800/50">
                      <Calendar className="w-3 h-3 text-orange-500/50" />
                      Expected Return: <span className="text-zinc-300 ml-auto">{member.returnDate}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => handleMakeActive(member)}
                    className="w-full py-3 rounded-2xl bg-zinc-800 text-white font-bold hover:bg-green-600 transition-all flex items-center justify-center gap-2 group/btn border border-zinc-700 hover:border-green-500/50"
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
