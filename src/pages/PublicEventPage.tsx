import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, onSnapshot, doc, query, orderBy, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GuildEvent, Member, Assignment, Party, SubEvent, GuildSettings } from '../types';
import { Shield, Sword, Heart, Star, Users, Calendar, Info, LayoutGrid, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const ROLES = [
  { name: 'Main DPS', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <Star className="w-3 h-3" /> },
  { name: 'Support', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', icon: <Heart className="w-3 h-3" /> },
  { name: 'Tank', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', icon: <Shield className="w-3 h-3" /> },
  { name: 'DPS', color: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-400/20', icon: <Sword className="w-3 h-3" /> },
];

export default function PublicEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<GuildEvent | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [parties, setParties] = useState<Record<string, Party[]>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSubEvents, setCollapsedSubEvents] = useState<Set<string>>(new Set());
  const [guildSettings, setGuildSettings] = useState<GuildSettings | null>(null);

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'guild_settings');
    getDoc(settingsRef).then(docSnap => {
      if (docSnap.exists()) {
        setGuildSettings(docSnap.data() as GuildSettings);
      }
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
    if (!eventId) return;

    const fetchEvent = async () => {
      try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
          setEvent({ id: eventDoc.id, ...eventDoc.data() } as GuildEvent);
        } else {
          setError('Event not found.');
          setLoading(false);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `events/${eventId}`);
        setError('Error loading event.');
        setLoading(false);
      }
    };

    fetchEvent();

    const membersQuery = query(collection(db, 'members'), orderBy('ign', 'asc'));
    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      setMembers(membersData);
    }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'members');
    });

    const subEventsRef = collection(db, 'events', eventId, 'subevents');
    const unsubscribes: (() => void)[] = [];

    const unsubscribeSubEvents = onSnapshot(subEventsRef, (snapshot) => {
      const subEventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubEvent));
      // Sort by order, fallback to name
      subEventsData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
      setSubEvents(subEventsData);
      
      // Clean up previous nested listeners
      unsubscribes.forEach(unsub => unsub());
      unsubscribes.length = 0;

      subEventsData.forEach(subEvent => {
        const partiesRef = collection(db, 'events', eventId, 'subevents', subEvent.id!, 'parties');
        const unsubParties = onSnapshot(partiesRef, (snap) => {
          const partiesData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Party));
          setParties(prev => ({ ...prev, [subEvent.id!]: partiesData }));
          
          partiesData.forEach(party => {
            const assignmentsRef = collection(db, 'events', eventId, 'subevents', subEvent.id!, 'parties', party.id!, 'assignments');
            const unsubAssignments = onSnapshot(assignmentsRef, (aSnap) => {
              const assignmentsData = aSnap.docs.map(ad => ({ id: ad.id, ...ad.data() } as Assignment));
              setAssignments(prev => ({ ...prev, [party.id!]: assignmentsData }));
            }, (err) => {
                handleFirestoreError(err, OperationType.LIST, `events/${eventId}/subevents/${subEvent.id}/parties/${party.id}/assignments`);
            });
            unsubscribes.push(unsubAssignments);
          });
        }, (err) => {
            handleFirestoreError(err, OperationType.LIST, `events/${eventId}/subevents/${subEvent.id}/parties`);
        });
        unsubscribes.push(unsubParties);
      });
      setLoading(false);
    }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `events/${eventId}/subevents`);
        setLoading(false);
    });

    return () => {
      unsubscribeMembers();
      unsubscribeSubEvents();
      unsubscribes.forEach(unsub => unsub());
    };
  }, [eventId]);

  const getMemberName = (id: string) => members.find(m => m.id === id)?.ign || 'Unknown Member';
  const getMemberJob = (id: string) => members.find(m => m.id === id)?.job || 'Unknown Job';
  const getRoleConfig = (roleName: string) => ROLES.find(r => r.name === roleName) || ROLES[3];

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
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
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
            {event.description || guildSettings?.subtitle}
          </p>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                return (
                                  <div
                                    key={assignment.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 group"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", role.bg, role.border, role.color)}>
                                        {role.icon}
                                      </div>
                                      <div>
                                        <div className="font-bold text-zinc-100 text-sm">{getMemberName(assignment.memberId)}</div>
                                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{getMemberJob(assignment.memberId)}</div>
                                      </div>
                                    </div>
                                    <div className={cn("text-[10px] font-black uppercase px-2 py-1 rounded border", role.bg, role.border, role.color)}>
                                      {assignment.role}
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
        </div>

        <footer className="mt-20 pt-8 border-t border-zinc-900 text-center">
          <p className="text-zinc-700 text-[10px] font-bold uppercase tracking-[0.2em]">
            MadMonkeys Guild Manager • {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
