import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GuildEvent, Member, Assignment, Party, SubEvent } from '../types';
import { Plus, Edit2, Trash2, X, Users, UserPlus, UserMinus, Info, LayoutGrid, Shield, Sword, Heart, Star, Share2, Check, Layers, ChevronUp, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ROLES = [
  { name: 'Main DPS', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <Star className="w-3 h-3" /> },
  { name: 'Support', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', icon: <Heart className="w-3 h-3" /> },
  { name: 'Tank', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', icon: <Shield className="w-3 h-3" /> },
  { name: 'DPS', color: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-400/20', icon: <Sword className="w-3 h-3" /> },
];

interface EventsPageProps {
  isAdmin?: boolean;
}

interface SortableSubEventItemProps {
  subEvent: SubEvent;
  event: GuildEvent;
  isAdmin: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  parties: Party[];
  assignments: Record<string, Assignment[]>;
  members: Member[];
  openPartyModal: (eventId: string, subEventId: string, party?: Party) => void;
  openSubEventModal: (eventId: string, subEvent?: SubEvent) => void;
  deleteSubEvent: (eventId: string, subEventId: string) => void;
  openAssignModal: (eventId: string, subEventId: string, partyId: string) => void;
  unassignMember: (eventId: string, subEventId: string, partyId: string, assignmentId: string) => void;
  deleteParty: (eventId: string, subEventId: string, partyId: string) => void;
  getRoleStyle: (roleName: string) => any;
}

function SortableSubEventItem({
  subEvent,
  event,
  isAdmin,
  isCollapsed,
  onToggleCollapse,
  parties,
  assignments,
  members,
  openPartyModal,
  openSubEventModal,
  deleteSubEvent,
  openAssignModal,
  unassignMember,
  deleteParty,
  getRoleStyle,
}: SortableSubEventItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subEvent.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("space-y-4", isDragging && "opacity-50")}>
      <div className="flex items-center justify-between bg-zinc-800/30 p-3 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <button 
            onClick={onToggleCollapse}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-500">
            <Layers className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-white">{subEvent.name}</h4>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => openPartyModal(event.id!, subEvent.id!)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Party
              </button>
              <button
                onClick={() => openSubEventModal(event.id!, subEvent)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteSubEvent(event.id!, subEvent.id!)}
                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {parties.map((party) => (
                <div key={party.id} className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      <h5 className="font-bold text-sm text-white uppercase tracking-wider">{party.name}</h5>
                      <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                        {assignments[party.id!]?.length || 0}/5
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openAssignModal(event.id!, subEvent.id!, party.id!)}
                            className="p-1.5 text-zinc-400 hover:text-orange-500 transition-colors"
                            title="Assign Member"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openPartyModal(event.id!, subEvent.id!, party)}
                            className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                            title="Edit Party Name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteParty(event.id!, subEvent.id!, party.id!)}
                            className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {assignments[party.id!]?.map((assignment) => {
                      const member = members.find(m => m.id === assignment.memberId);
                      const roleStyle = getRoleStyle(assignment.role);
                      return (
                        <div key={assignment.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50 group">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold", roleStyle.bg, roleStyle.color)}>
                              {member?.ign.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white leading-none">{member?.ign}</p>
                              <div className={cn("flex items-center gap-1 text-[9px] font-bold uppercase mt-1", roleStyle.color)}>
                                {roleStyle.icon}
                                {assignment.role}
                              </div>
                            </div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => unassignMember(event.id!, subEvent.id!, party.id!, assignment.id!)}
                              className="p-1 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {(!assignments[party.id!] || assignments[party.id!].length === 0) && (
                      <div className="py-4 text-center text-zinc-700 text-xs italic">
                        Empty Party
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {parties.length === 0 && (
                <div className="col-span-full py-4 text-center border border-dashed border-zinc-800 rounded-xl text-zinc-700 text-xs">
                  No parties created for this sub event
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EventsPage({ isAdmin = false }: EventsPageProps) {
  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [subEvents, setSubEvents] = useState<Record<string, SubEvent[]>>({});
  const [parties, setParties] = useState<Record<string, Party[]>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSubEventModalOpen, setIsSubEventModalOpen] = useState(false);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const [editingEvent, setEditingEvent] = useState<GuildEvent | null>(null);
  const [editingSubEvent, setEditingSubEvent] = useState<SubEvent | null>(null);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeSubEventId, setActiveSubEventId] = useState<string | null>(null);
  const [activePartyId, setActivePartyId] = useState<string | null>(null);
  
  const [collapsedEvents, setCollapsedEvents] = useState<Set<string>>(new Set());
  const [collapsedSubEvents, setCollapsedSubEvents] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleEventCollapse = (id: string) => {
    setCollapsedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubEventCollapse = (id: string) => {
    setCollapsedSubEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const [eventFormData, setEventFormData] = useState({ name: '', description: '' });
  const [subEventFormData, setSubEventFormData] = useState({ name: '' });
  const [partyFormData, setPartyFormData] = useState({ name: '' });
  const [assignFormData, setAssignFormData] = useState({ memberId: '', role: ROLES[0].name });

  useEffect(() => {
    const eventsQuery = query(collection(db, 'events'), orderBy('name', 'asc'));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuildEvent));
      setEvents(eventsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
      setLoading(false);
    });

    const membersQuery = query(collection(db, 'members'), orderBy('ign', 'asc'));
    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      setMembers(membersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    return () => {
      unsubscribeEvents();
      unsubscribeMembers();
    };
  }, []);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    events.forEach(event => {
      // Fetch SubEvents
      const subEventsRef = collection(db, 'events', event.id!, 'subevents');
      const unsubSubEvents = onSnapshot(subEventsRef, (snapshot) => {
        const subEventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubEvent));
        // Sort by order, fallback to name
        subEventsData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
        setSubEvents(prev => ({ ...prev, [event.id!]: subEventsData }));
        
        // For each subevent, fetch parties
        subEventsData.forEach(subEvent => {
          const partiesRef = collection(db, 'events', event.id!, 'subevents', subEvent.id!, 'parties');
          const unsubParties = onSnapshot(partiesRef, (snapshot) => {
            const partiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Party));
            setParties(prev => ({ ...prev, [subEvent.id!]: partiesData }));
            
            // For each party, fetch assignments
            partiesData.forEach(party => {
              const assignmentsRef = collection(db, 'events', event.id!, 'subevents', subEvent.id!, 'parties', party.id!, 'assignments');
              const unsubAssignments = onSnapshot(assignmentsRef, (snapshot) => {
                const assignmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment));
                setAssignments(prev => ({ ...prev, [party.id!]: assignmentsData }));
              }, (error) => {
                handleFirestoreError(error, OperationType.LIST, `events/${event.id}/subevents/${subEvent.id}/parties/${party.id}/assignments`);
              });
              unsubscribes.push(unsubAssignments);
            });
          }, (error) => {
            handleFirestoreError(error, OperationType.LIST, `events/${event.id}/subevents/${subEvent.id}/parties`);
          });
          unsubscribes.push(unsubParties);
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `events/${event.id}/subevents`);
      });
      unsubscribes.push(unsubSubEvents);
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [events]);

  const handleShare = (eventId: string) => {
    const url = `${window.location.origin}/public/event/${eventId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(eventId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id!), eventFormData);
      } else {
        await addDoc(collection(db, 'events'), eventFormData);
      }
      closeEventModal();
    } catch (error) {
      handleFirestoreError(error, editingEvent ? OperationType.UPDATE : OperationType.CREATE, `events/${editingEvent?.id || ''}`);
    }
  };

  const handleSubEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEventId) return;
    try {
      if (editingSubEvent) {
        await updateDoc(doc(db, 'events', activeEventId, 'subevents', editingSubEvent.id!), subEventFormData);
      } else {
        const currentSubEvents = subEvents[activeEventId] || [];
        const nextOrder = currentSubEvents.length > 0 
          ? Math.max(...currentSubEvents.map(s => s.order)) + 1 
          : 0;
        await addDoc(collection(db, 'events', activeEventId, 'subevents'), {
          ...subEventFormData,
          order: nextOrder
        });
      }
      setIsSubEventModalOpen(false);
      setEditingSubEvent(null);
      setSubEventFormData({ name: '' });
    } catch (error) {
      handleFirestoreError(error, editingSubEvent ? OperationType.UPDATE : OperationType.CREATE, `events/${activeEventId}/subevents/${editingSubEvent?.id || ''}`);
    }
  };

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEventId || !activeSubEventId) return;
    try {
      if (editingParty) {
        await updateDoc(doc(db, 'events', activeEventId, 'subevents', activeSubEventId, 'parties', editingParty.id!), partyFormData);
      } else {
        await addDoc(collection(db, 'events', activeEventId, 'subevents', activeSubEventId, 'parties'), {
          ...partyFormData,
          eventId: activeEventId,
          subEventId: activeSubEventId
        });
      }
      setIsPartyModalOpen(false);
      setEditingParty(null);
      setPartyFormData({ name: '' });
    } catch (error) {
      handleFirestoreError(error, editingParty ? OperationType.UPDATE : OperationType.CREATE, `events/${activeEventId}/subevents/${activeSubEventId}/parties/${editingParty?.id || ''}`);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEventId || !activeSubEventId || !activePartyId) return;
    
    // Check 5 member limit
    const currentAssignments = assignments[activePartyId] || [];
    if (currentAssignments.length >= 5) {
      alert("Party is full! Maximum 5 members allowed.");
      return;
    }

    const assignmentId = `${activePartyId}_${assignFormData.memberId}`;
    try {
      await setDoc(doc(db, 'events', activeEventId, 'subevents', activeSubEventId, 'parties', activePartyId, 'assignments', assignmentId), {
        memberId: assignFormData.memberId,
        role: assignFormData.role,
        eventId: activeEventId,
        subEventId: activeSubEventId,
        partyId: activePartyId
      });
      setIsAssignModalOpen(false);
      setAssignFormData({ memberId: '', role: ROLES[0].name });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${activeEventId}/subevents/${activeSubEventId}/parties/${activePartyId}/assignments/${assignmentId}`);
    }
  };

  const unassignMember = async (eventId: string, subEventId: string, partyId: string, assignmentId: string) => {
    try {
      await deleteDoc(doc(db, 'events', eventId, 'subevents', subEventId, 'parties', partyId, 'assignments', assignmentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${eventId}/subevents/${subEventId}/parties/${partyId}/assignments/${assignmentId}`);
    }
  };

  const deleteParty = async (eventId: string, subEventId: string, partyId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Party',
      message: 'Are you sure you want to delete this party and all its assignments? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'events', eventId, 'subevents', subEventId, 'parties', partyId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `events/${eventId}/subevents/${subEventId}/parties/${partyId}`);
        }
      }
    });
  };

  const deleteSubEvent = async (eventId: string, subEventId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Sub Event',
      message: 'Are you sure you want to delete this sub event? All parties and assignments will be lost.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'events', eventId, 'subevents', subEventId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `events/${eventId}/subevents/${subEventId}`);
        }
      }
    });
  };

  const deleteEvent = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Event',
      message: 'Are you sure you want to delete this event? All parties and assignments will be lost.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'events', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
        }
      }
    });
  };

  const reorderSubEvent = async (eventId: string, subEventId: string, direction: 'up' | 'down') => {
    const eventSubEvents = [...(subEvents[eventId] || [])];
    const index = eventSubEvents.findIndex(s => s.id === subEventId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= eventSubEvents.length) return;

    const currentSubEvent = eventSubEvents[index];
    const otherSubEvent = eventSubEvents[newIndex];

    try {
      await updateDoc(doc(db, 'events', eventId, 'subevents', currentSubEvent.id!), { order: otherSubEvent.order });
      await updateDoc(doc(db, 'events', eventId, 'subevents', otherSubEvent.id!), { order: currentSubEvent.order });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}/subevents`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, eventId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const eventSubEvents = [...(subEvents[eventId] || [])];
    const oldIndex = eventSubEvents.findIndex((s) => s.id === active.id);
    const newIndex = eventSubEvents.findIndex((s) => s.id === over.id);

    const reordered = arrayMove(eventSubEvents, oldIndex, newIndex);
    
    // Update state immediately for smooth UI
    setSubEvents(prev => ({ ...prev, [eventId]: reordered }));

    // Update Firestore orders
    try {
      const updates = reordered.map((sub, index) => 
        updateDoc(doc(db, 'events', eventId, 'subevents', sub.id!), { order: index })
      );
      await Promise.all(updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}/subevents`);
    }
  };

  const openEventModal = (event?: GuildEvent) => {
    if (event) {
      setEditingEvent(event);
      setEventFormData({ name: event.name, description: event.description || '' });
    } else {
      setEditingEvent(null);
      setEventFormData({ name: '', description: '' });
    }
    setIsEventModalOpen(true);
  };

  const closeEventModal = () => {
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const openSubEventModal = (eventId: string, subEvent?: SubEvent) => {
    setActiveEventId(eventId);
    if (subEvent) {
      setEditingSubEvent(subEvent);
      setSubEventFormData({ name: subEvent.name });
    } else {
      setEditingSubEvent(null);
      setSubEventFormData({ name: '' });
    }
    setIsSubEventModalOpen(true);
  };

  const openPartyModal = (eventId: string, subEventId: string, party?: Party) => {
    setActiveEventId(eventId);
    setActiveSubEventId(subEventId);
    if (party) {
      setEditingParty(party);
      setPartyFormData({ name: party.name });
    } else {
      setEditingParty(null);
      setPartyFormData({ name: `Party ${(parties[subEventId]?.length || 0) + 1}` });
    }
    setIsPartyModalOpen(true);
  };

  const openAssignModal = (eventId: string, subEventId: string, partyId: string) => {
    setActiveEventId(eventId);
    setActiveSubEventId(subEventId);
    setActivePartyId(partyId);
    setIsAssignModalOpen(true);
  };

  const getRoleStyle = (roleName: string) => {
    return ROLES.find(r => r.name === roleName) || ROLES[3];
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Regular Events</h1>
          <p className="text-zinc-500">Weekly guild activities and party setups</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => openEventModal()}
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-5 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-5 h-5" />
            Add Regular Event
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {events.map((event) => (
            <motion.div
              key={event.id}
              layout
              className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50">
                <div className="flex items-start gap-4 flex-1">
                  <button 
                    onClick={() => toggleEventCollapse(event.id!)}
                    className="mt-1 text-zinc-500 hover:text-white transition-colors"
                  >
                    {collapsedEvents.has(event.id!) ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{event.name}</h3>
                    <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-1">
                      <Info className="w-3.5 h-3.5" />
                      {event.description || 'Regular weekly event'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShare(event.id!)}
                    className={cn(
                      "flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                      copiedId === event.id
                        ? "bg-green-500/10 text-green-500 border border-green-500/20"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    )}
                  >
                    {copiedId === event.id ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    {copiedId === event.id ? 'Copied!' : 'Share Lineup'}
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => openSubEventModal(event.id!)}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Sub Event
                      </button>
                      <button
                        onClick={() => openEventModal(event)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteEvent(event.id!)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {!collapsedEvents.has(event.id!) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 space-y-8">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => handleDragEnd(e, event.id!)}
                      >
                        <SortableContext
                          items={subEvents[event.id!]?.map(s => s.id!) || []}
                          strategy={verticalListSortingStrategy}
                        >
                          {subEvents[event.id!]?.map((subEvent) => (
                            <SortableSubEventItem
                              key={subEvent.id}
                              subEvent={subEvent}
                              event={event}
                              isAdmin={isAdmin}
                              isCollapsed={collapsedSubEvents.has(subEvent.id!)}
                              onToggleCollapse={() => toggleSubEventCollapse(subEvent.id!)}
                              parties={parties[subEvent.id!] || []}
                              assignments={assignments}
                              members={members}
                              openPartyModal={openPartyModal}
                              openSubEventModal={openSubEventModal}
                              deleteSubEvent={deleteSubEvent}
                              openAssignModal={openAssignModal}
                              unassignMember={unassignMember}
                              deleteParty={deleteParty}
                              getRoleStyle={getRoleStyle}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                      {(!subEvents[event.id!] || subEvents[event.id!].length === 0) && (
                        <div className="py-12 text-center border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600">
                          <Layers className="w-8 h-8 mx-auto mb-3 opacity-20" />
                          <p>No sub events created for this event</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Event Modal */}
      <AnimatePresence>
        {isEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeEventModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">{editingEvent ? 'Edit Event' : 'Add Regular Event'}</h2>
              <form onSubmit={handleEventSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Event Name</label>
                  <input required type="text" value={eventFormData.name} onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white" placeholder="e.g. Guild War" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Description</label>
                  <textarea value={eventFormData.description} onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white h-24 resize-none" placeholder="Regular weekly schedule..." />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={closeEventModal} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20">{editingEvent ? 'Save' : 'Add'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sub Event Modal */}
      <AnimatePresence>
        {isSubEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSubEventModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">{editingSubEvent ? 'Edit Sub Event' : 'Add Sub Event'}</h2>
              <form onSubmit={handleSubEventSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Sub Event Name</label>
                  <input required type="text" value={subEventFormData.name} onChange={(e) => setSubEventFormData({ ...subEventFormData, name: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white" placeholder="e.g. Main Field" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsSubEventModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20">{editingSubEvent ? 'Save' : 'Add'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Party Modal */}
      <AnimatePresence>
        {isPartyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPartyModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">{editingParty ? 'Edit Party Name' : 'Create New Party'}</h2>
              <form onSubmit={handlePartySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Party Name</label>
                  <input required type="text" value={partyFormData.name} onChange={(e) => setPartyFormData({ ...partyFormData, name: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white" placeholder="e.g. Party 1" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setIsPartyModalOpen(false); setEditingParty(null); }} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20">{editingParty ? 'Save' : 'Create'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assign Modal */}
      <AnimatePresence>
        {isAssignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAssignModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Assign to {parties[activeSubEventId!]?.find(p => p.id === activePartyId)?.name}</h2>
              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Select Member</label>
                  <select required value={assignFormData.memberId} onChange={(e) => setAssignFormData({ ...assignFormData, memberId: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white">
                    <option value="">Choose a member...</option>
                    {members
                      .filter(m => {
                        // Filter out members already assigned to ANY party in this sub event
                        const assignedMemberIds = (parties[activeSubEventId!] || [])
                          .flatMap(p => assignments[p.id!] || [])
                          .map(a => a.memberId);
                        return !assignedMemberIds.includes(m.id!);
                      })
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.ign} ({m.job})</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(role => (
                      <button
                        key={role.name}
                        type="button"
                        onClick={() => setAssignFormData({ ...assignFormData, role: role.name })}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all",
                          assignFormData.role === role.name 
                            ? cn(role.bg, role.color, "border-orange-500/50") 
                            : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
                        )}
                      >
                        {role.icon}
                        {role.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20">Assign</button>
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
        variant={confirmModal.variant}
      />
    </div>
  );
}
