import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { fetchAPI } from '../lib/api';
import { GuildEvent, Member, Assignment, Party, SubEvent, GuildSettings } from '../types';
import { Shield, Sword, Heart, Star, Users, Calendar, Info, LayoutGrid, Layers, ChevronDown, ChevronRight, Cross, Zap, Target, Skull, Hammer, FlaskConical, Music, Hand, UserMinus, Check, MessageSquare, Trophy, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';

const getMemberCategory = (member: Member) => {
  if (member.role) return member.role;
  const supports = ['Gypsy', 'Minstrel', 'High Priest', 'Minstrel (M)', 'Gypsy (F)'];
  const tanks = ['Paladin'];
  
  if (supports.includes(member.job)) return 'Support';
  if (tanks.includes(member.job)) return 'Tank';
  return 'DPS';
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Support': return 'text-blue-400';
    case 'Tank': return 'text-orange-400';
    default: return 'text-zinc-400';
  }
};

const getJobIcon = (member: Member) => {
  const job = member.job || '';
  const j = job.toLowerCase();
  const category = getMemberCategory(member);
  const color = getCategoryColor(category);
  
  let icon = <Star className="w-4 h-4" />;
  if (j.includes('knight')) icon = <Sword className="w-4 h-4" />;
  if (j.includes('paladin')) icon = <Shield className="w-4 h-4" />;
  if (j.includes('priest')) icon = <Cross className="w-4 h-4" />;
  if (j.includes('wizard')) icon = <Zap className="w-4 h-4" />;
  if (j.includes('sniper')) icon = <Target className="w-4 h-4" />;
  if (j.includes('assassin')) icon = <Skull className="w-4 h-4" />;
  if (j.includes('whitesmith')) icon = <Hammer className="w-4 h-4" />;
  if (j.includes('creator')) icon = <FlaskConical className="w-4 h-4" />;
  if (j.includes('gypsy') || j.includes('minstrel')) icon = <Music className="w-4 h-4" />;
  if (j.includes('champion')) icon = <Hand className="w-4 h-4" />;
  
  return icon;
};

export default function PublicEventPage() {
  const { eventId, token } = useParams<{ eventId?: string; token?: string }>();
  const [event, setEvent] = useState<GuildEvent | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [parties, setParties] = useState<Record<string, Party[]>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSubEvents, setCollapsedSubEvents] = useState<Set<string>>(new Set());
  const [guildSettings, setGuildSettings] = useState<GuildSettings | null>(null);

  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => {
    fetchAPI('/api/settings/guild_settings').then(data => {
      setGuildSettings(data);
    });
  }, []);

  const toggleSubEventCollapse = (subEventId: string) => {
    setCollapsedSubEvents(prev => {
      const next = new Set(prev);
      if (next.has(subEventId)) {
        next.delete(subEventId);
      } else {
        next.add(subEventId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!eventId && !token) return;

    const loadData = async () => {
      try {
        const [eventData, membersData, jobsData, rolesData] = await Promise.all([
          token ? fetchAPI(`/api/public/events/by-token/${token}`) : fetchAPI(`/api/events/${eventId}`),
          fetchAPI('/api/members'),
          fetchAPI('/api/jobs'),
          fetchAPI('/api/roles')
        ]);
        
        setMembers(membersData);
        setEvent(eventData);
        setJobs(jobsData);
        setRoles(rolesData || []);
        
        // Process nested data from eventData
        const subEventsData = [...(eventData.subevents || [])];
        subEventsData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
        setSubEvents(subEventsData);
        
        const newParties: Record<string, Party[]> = {};
        const newAssignments: Record<string, Assignment[]> = {};
        
        for (const subEvent of subEventsData) {
          const partiesData = [...(subEvent.parties || [])];
          partiesData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
          newParties[subEvent.id!] = partiesData;
          
          for (const party of partiesData) {
            const assignmentsData = [...(party.assignments || [])].filter(a => {
              const member = membersData.find((m: any) => m.id === a.memberId);
              return !member || member.status !== 'on-leave';
            });
            assignmentsData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            newAssignments[party.id!] = assignmentsData;
          }
        }
        
        setParties(newParties);
        setAssignments(newAssignments);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading event data:', err);
        setError(err.message || 'Error loading event.');
        setLoading(false);
      }
    };

    loadData();
    
    // Add polling for sync every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [eventId, token]);

  const getMemberName = (id: string) => members.find(m => m.id === id)?.ign || 'Unknown Member';
  const getMemberJob = (id: string) => members.find(m => m.id === id)?.job || 'Unknown Job';
  
  const getRoleConfig = (roleName: string) => {
    const role = roles.find(r => r.name === roleName);
    if (role) {
      return { 
        name: role.name, 
        color: role.color, 
        bg: `${role.color}10`, // 10% opacity hex
        border: `${role.color}20`, // 20% opacity hex
        icon: <Shield className="w-3 h-3" /> // Default icon for dynamic roles
      };
    }
    return { name: roleName, color: '#a1a1aa', bg: '#a1a1aa10', border: '#a1a1aa20', icon: <Shield className="w-3 h-3" /> };
  };

  const [reportingAbsence, setReportingAbsence] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [absenceSuccess, setAbsenceSuccess] = useState(false);

  const [discordMessage, setDiscordMessage] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  const nextEventDays = useMemo(() => {
    const days = [];
    const now = new Date();
    const schedule = event?.schedule || [];
    
    if (schedule.length === 0) {
      // Fallback to next 15 days if no schedule set
      for (let i = 0; i < 15; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() + i);
        days.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
      }
      return days;
    }

    // Find next 15 occurrences based on schedule
    let currentDate = new Date(now);
    let count = 0;
    let safety = 0;
    while (count < 15 && safety < 365) {
      if (schedule.includes(currentDate.getDay())) {
        days.push(currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
      safety++;
    }
    return days;
  }, [event?.schedule]);

  const toggleDate = (date: string) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      if (prev.length >= 15) return prev;
      return [...prev, date];
    });
  };

  useEffect(() => {
    setSelectedDates([]);
  }, [eventId, token]);

  const handleReportAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !event?.id) return;
    
    setReportingAbsence(true);
    try {
      await fetchAPI(`/api/events/${event.id}/absent`, {
        method: 'POST',
        body: JSON.stringify({ 
          memberId: selectedMemberId,
          message: discordMessage,
          dates: selectedDates
        })
      });
      setAbsenceSuccess(true);
      setSelectedMemberId('');
      setDiscordMessage('');
      setSelectedDates([]);
      
      // Reload data to show updated list
      const [eventData, membersData] = await Promise.all([
        token ? fetchAPI(`/api/public/events/by-token/${token}`) : fetchAPI(`/api/events/${event.id}`),
        fetchAPI('/api/members')
      ]);
      setMembers(membersData);
      setEvent(eventData);
      setTimeout(() => setAbsenceSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error reporting absence:', err);
      alert(err.message || 'Failed to report absence.');
    } finally {
      setReportingAbsence(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500 animate-pulse">Loading Lineup...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500">{error || 'Event not found.'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-12 text-center relative">
          <div className="absolute top-0 right-0">
            <Link 
              to="/raffle" 
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-4 py-2 rounded-xl border border-zinc-800 transition-all text-sm font-bold"
            >
              <Trophy className="w-4 h-4 text-orange-500" />
              Weekly Raffle
            </Link>
          </div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold uppercase tracking-widest mb-4"
          >
            {guildSettings?.logoUrl ? (
              <img src={guildSettings.logoUrl} alt="" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Calendar className="w-3 h-3" />
            )}
            {guildSettings?.name || 'Guild'} Event Lineup
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 uppercase italic">
            {event.name}
          </h1>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg">
            {event.description}
          </p>
          <div className="mt-8 max-w-5xl mx-auto text-left space-y-6">
            {event.instructions && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-orange-500/5 border border-orange-500/10 rounded-2xl w-full"
              >
                <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Zap className="w-3 h-3" />
                  Special Instructions
                </h4>
                <div 
                  className="text-sm text-zinc-400 leading-relaxed prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.instructions) }}
                />
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-zinc-900/80 border border-zinc-800 rounded-2xl max-w-xl mx-auto w-full"
            >
              <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Leave Request
              </h4>
              <p className="text-sm text-zinc-400 mb-4">
                If you cannot attend this event or will be away, please select your name and provide details.
              </p>
              
              <div className="space-y-4">
                <form onSubmit={handleReportAbsence} className="space-y-4">
                  <div className="relative">
                    <select
                      required
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none pr-10"
                    >
                      <option value="">Select your IGN</option>
                      {members
                        .filter(m => (m.status || 'active') === 'active')
                        .sort((a, b) => a.ign.localeCompare(b.ign))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.ign}
                          </option>
                        ))
                      }
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>

                  {selectedMemberId && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Dates of Absence (Max 15 Event Days)</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {nextEventDays.map(date => (
                            <button
                              key={date}
                              type="button"
                              onClick={() => toggleDate(date)}
                              className={cn(
                                "px-2 py-2 rounded-lg text-[10px] font-bold transition-all border",
                                selectedDates.includes(date)
                                  ? "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20"
                                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                              )}
                            >
                              {date}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        required
                        value={discordMessage}
                        onChange={(e) => setDiscordMessage(e.target.value)}
                        placeholder="Reason for absence (e.g. Work, Family, etc.)"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all h-20 resize-none"
                      />

                      <button
                        type="submit"
                        disabled={reportingAbsence}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                      >
                        {reportingAbsence ? 'Processing...' : 'Mark Absent & Send Message'}
                      </button>
                    </>
                  )}
                </form>
              </div>

              {absenceSuccess && (
                <p className="mt-3 text-xs text-green-500 font-bold flex items-center gap-1.5">
                  <Check className="w-3 h-3" />
                  You have been marked as absent and your message has been sent.
                </p>
              )}
            </motion.div>
          </div>
        </header>

        <div className="space-y-12">
          {subEvents.map((subEvent) => {
            const isCollapsed = collapsedSubEvents.has(subEvent.id!);
            return (
              <div key={subEvent.id} className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleSubEventCollapse(subEvent.id!)}
                      className="text-zinc-500 hover:text-white transition-colors"
                    >
                      {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-bold uppercase tracking-tight">{subEvent.name}</h2>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {parties[subEvent.id!]?.map((party, index) => (
                          <motion.div
                            key={party.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                                <LayoutGrid className="w-5 h-5 text-blue-500" />
                                {party.name}
                              </h3>
                              <span className="text-xs font-mono text-zinc-600 uppercase tracking-widest">
                                {assignments[party.id!]?.length || 0}/5
                              </span>
                            </div>

                            <div className="space-y-3">
                              {assignments[party.id!]?.map((assignment) => {
                                const role = getRoleConfig(assignment.role);
                                const member = members.find(m => m.id === assignment.memberId);
                                
                                return (
                                  <div
                                    key={assignment.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 group"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div 
                                        className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-400" 
                                      >
                                        {member ? getJobIcon(member) : <Star className="w-5 h-5 text-zinc-500" />}
                                      </div>
                                      <div>
                                        <div className="font-bold text-zinc-100 text-[1em]">{member?.ign || 'Unknown'}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <div 
                                            className="flex items-center gap-1 text-[9px] font-bold uppercase"
                                            style={{ color: role.color }}
                                          >
                                            {role.icon}
                                            {assignment.role}
                                          </div>
                                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">• {member?.job || 'Unknown'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {Array.from({ length: 5 - (assignments[party.id!]?.length || 0) }).map((_, i) => (
                                <div key={`empty-${i}`} className="h-[58px] rounded-xl border border-dashed border-zinc-800 flex items-center justify-center">
                                  <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest italic">Slot Available</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                        {(!parties[subEvent.id!] || parties[subEvent.id!].length === 0) && (
                          <div className="col-span-full py-10 text-center border border-dashed border-zinc-800 rounded-3xl">
                            <p className="text-zinc-700 font-bold uppercase tracking-widest italic text-xs">No parties formed for this sub event</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {subEvents.length === 0 && (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-3xl">
              <Users className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
              <p className="text-zinc-600 font-bold uppercase tracking-widest italic">No sub events or parties formed yet</p>
            </div>
          )}

          {/* Bottom Sections: Unassigned and Unavailable Members */}
          {(() => {
            const assignedMemberIds = new Set<string>();
            Object.values(assignments).forEach(partyAssignments => {
              partyAssignments.forEach(a => {
                assignedMemberIds.add(a.memberId);
              });
            });
            
            const unavailableMembers = [
              ...(event.absences || []),
              ...members
                .filter(m => m.status === 'on-leave')
                .filter(m => !(event.absences || []).some(a => a.memberId === m.id))
                .map(m => ({
                  memberId: m.id,
                  ign: m.ign,
                  job: m.job,
                  role: m.role,
                  reason: m.leaveReason || 'On Leave (Admin Set)',
                  dates: m.leaveDates || [],
                  timestamp: m.leaveStartedAt || new Date().toISOString()
                }))
            ];
            const unassignedMembers = members
              .filter(m => {
                const status = m.status || 'active';
                return status === 'active' || status === 'busy';
              })
              .filter(m => 
                !assignedMemberIds.has(m.id!) && 
                !unavailableMembers.some(a => a.memberId === m.id)
              );

            if (unassignedMembers.length === 0 && unavailableMembers.length === 0) return null;

            return (
              <div className="mt-20 pt-12 border-t border-zinc-900 space-y-16">
                {unassignedMembers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-12 h-12 bg-zinc-500/10 rounded-2xl flex items-center justify-center text-zinc-500">
                        <UserMinus className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold uppercase tracking-tight">Unassigned Members</h2>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">
                          {unassignedMembers.length} {unassignedMembers.length === 1 ? 'Member' : 'Members'} not in any party
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                        {unassignedMembers.map(m => {
                          return (
                            <motion.div 
                              key={m.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/30 border border-zinc-800/50"
                            >
                              <div 
                                className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-900 shrink-0 border border-zinc-800 text-zinc-400"
                              >
                                {getJobIcon(m)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-zinc-300 truncate">{m.ign}</p>
                                <p className="text-[10px] text-zinc-600 truncate uppercase font-bold tracking-wider">{m.job}</p>
                              </div>
                            </motion.div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {unavailableMembers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold uppercase tracking-tight text-orange-500/80">Away / On Leave</h2>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">
                          {unavailableMembers.length} {unavailableMembers.length === 1 ? 'Member' : 'Members'} reported absence
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {unavailableMembers.map(absence => (
                        <motion.div 
                          key={absence.memberId}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl relative group hover:border-orange-500/30 transition-all shadow-xl"
                        >
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-xl border border-orange-500/20">
                              {absence.ign.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-zinc-100 text-lg truncate">{absence.ign}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                  {(absence as any).job || getMemberJob(absence.memberId)}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                  {(absence as any).role || getMemberCategory(members.find(m => m.id === absence.memberId) || { job: '' } as any)}
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
                                  "{absence.reason}"
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase mt-2">
                                <Calendar className="w-3 h-3 text-orange-500/50" />
                                Reported on {new Date(absence.timestamp).toLocaleDateString()}
                              </div>
                            </div>
                            
                            {absence.dates && absence.dates.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {absence.dates.map(date => (
                                  <span key={date} className="text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-700/50">
                                    {date}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <footer className="mt-20 pt-8 border-t border-zinc-900 text-center">
          <p className="text-zinc-700 text-[10px] font-bold uppercase tracking-[0.2em]">
            {guildSettings?.name || 'MadMonkeys'} Guild Manager • {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
