import { useState, useEffect, useCallback } from 'react';
import { fetchAPI } from '../lib/api';
import { GuildEvent, Member, Assignment, Party, SubEvent } from '../types';
import { Plus, Edit2, Trash2, X, Users, UserPlus, UserMinus, Info, LayoutGrid, Shield, Sword, Heart, Star, Share2, Check, Layers, ChevronUp, ChevronDown, ChevronRight, GripVertical, Search, Zap, Target, Music, Hammer, FlaskConical, Hand, Cross, Skull } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import {
  DndContext,
  closestCenter,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ROLES = [
  { name: 'DPS', color: 'text-zinc-400', bg: 'bg-zinc-400/10', border: 'border-zinc-400/20', icon: <Sword className="w-3 h-3" /> },
  { name: 'Support', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', icon: <Heart className="w-3 h-3" /> },
  { name: 'Tank', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', icon: <Shield className="w-3 h-3" /> },
];

const getMemberCategory = (member: Member) => {
  if (member.role) return member.role;
  
  const job = member.job || '';
  const supports = ['Gypsy', 'Minstrel', 'High Priest', 'Minstrel (M)', 'Gypsy (F)'];
  const tanks = ['Paladin'];
  
  if (supports.includes(job)) return 'Support';
  if (tanks.includes(job)) return 'Tank';
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
  
  return <div className={color}>{icon}</div>;
};

interface EventsPageProps {
  isAdmin?: boolean;
}

interface SortableAssignmentItemProps {
  assignment: Assignment;
  member: Member | undefined;
  roleStyle: any;
  isAdmin: boolean;
  onUnassign: () => void;
}

function SortableAssignmentItem({
  assignment,
  member,
  roleStyle,
  isAdmin,
  onUnassign,
}: SortableAssignmentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assignment.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50 group", isDragging && "opacity-50")}>
      <div className="flex items-center gap-3">
        {isAdmin && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-800")}>
          {member ? getJobIcon(member) : <Star className="w-4 h-4 text-zinc-500" />}
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">{member?.ign}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={cn("flex items-center gap-1 text-[9px] font-bold uppercase", roleStyle.color)}>
              {roleStyle.icon}
              {assignment.role}
            </div>
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">• {member?.job}</span>
          </div>
        </div>
      </div>
      {isAdmin && (
        <button
          onClick={onUnassign}
          className="p-1 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
        >
          <UserMinus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

interface SortablePartyItemProps {
  party: Party;
  event: GuildEvent;
  subEvent: SubEvent;
  isAdmin: boolean;
  assignments: Record<string, Assignment[]>;
  members: Member[];
  openAssignModal: (eventId: string, subEventId: string, partyId: string) => void;
  openPartyModal: (eventId: string, subEventId: string, party?: Party) => void;
  deleteParty: (eventId: string, subEventId: string, partyId: string) => void;
  unassignMember: (eventId: string, subEventId: string, partyId: string, assignmentId: string) => void;
  getRoleStyle: (roleName: string) => any;
  onReorderAssignments: (eventId: string, subEventId: string, partyId: string, reorderedAssignments: Assignment[]) => void;
}

function SortablePartyItem({
  party,
  event,
  subEvent,
  isAdmin,
  assignments,
  members,
  openAssignModal,
  openPartyModal,
  deleteParty,
  unassignMember,
  getRoleStyle,
  onReorderAssignments,
}: SortablePartyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: party.id!,
    data: {
      type: 'party',
      subEventId: subEvent.id,
      party
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAssignmentDragEnd = (eventDnd: DragEndEvent) => {
    const { active, over } = eventDnd;
    if (!over || active.id === over.id) return;

    const partyAssignments = assignments[party.id!] || [];
    const oldIndex = partyAssignments.findIndex((a) => a.id === active.id);
    const newIndex = partyAssignments.findIndex((a) => a.id === over.id);

    const reordered = arrayMove(partyAssignments, oldIndex, newIndex);
    onReorderAssignments(event.id!, subEvent.id!, party.id!, reordered);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full", isDragging && "opacity-50")}>
      <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}
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
      <div className="p-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleAssignmentDragEnd}
        >
          <SortableContext
            items={assignments[party.id!]?.map(a => a.id!) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {assignments[party.id!]?.map((assignment) => {
                const member = members.find(m => m.id === assignment.memberId);
                const roleStyle = getRoleStyle(assignment.role);
                return (
                  <SortableAssignmentItem
                    key={assignment.id}
                    assignment={assignment}
                    member={member}
                    roleStyle={roleStyle}
                    isAdmin={isAdmin}
                    onUnassign={() => unassignMember(event.id!, subEvent.id!, party.id!, assignment.id!)}
                  />
                );
              })}
              {(!assignments[party.id!] || assignments[party.id!].length === 0) && (
                <div className="py-4 text-center text-zinc-700 text-xs italic">
                  Empty Party
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
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
  onReorderParties: (eventId: string, subEventId: string, reorderedParties: Party[]) => void;
  onReorderAssignments: (eventId: string, subEventId: string, partyId: string, reorderedAssignments: Assignment[]) => void;
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
  onReorderParties,
  onReorderAssignments,
}: SortableSubEventItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: subEvent.id!,
    data: {
      type: 'subEvent',
      subEvent
    }
  });

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
            <SortableContext
              id={subEvent.id!}
              items={parties.map(p => p.id!)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {parties.map((party) => (
                  <SortablePartyItem
                    key={party.id}
                    party={party}
                    event={event}
                    subEvent={subEvent}
                    isAdmin={isAdmin}
                    assignments={assignments}
                    members={members}
                    openAssignModal={openAssignModal}
                    openPartyModal={openPartyModal}
                    deleteParty={deleteParty}
                    unassignMember={unassignMember}
                    getRoleStyle={getRoleStyle}
                    onReorderAssignments={onReorderAssignments}
                  />
                ))}
                {parties.length === 0 && (
                  <div className="col-span-full py-4 text-center border border-dashed border-zinc-800 rounded-xl text-zinc-700 text-xs">
                    No parties created for this sub event
                  </div>
                )}
              </div>
            </SortableContext>
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
  
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<'All' | 'DPS' | 'Support' | 'Tank'>('All');
  const [initialSubEventId, setInitialSubEventId] = useState<string | null>(null);

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
  
  const [eventFormData, setEventFormData] = useState({ name: '', description: '', instructions: '' });
  const [subEventFormData, setSubEventFormData] = useState({ name: '' });
  const [partyFormData, setPartyFormData] = useState({ name: '' });
  const [assignFormData, setAssignFormData] = useState({ memberId: '', role: ROLES[0].name });

  const loadData = useCallback(async () => {
    try {
      const [eventsData, membersData] = await Promise.all([
        fetchAPI('/api/events'),
        fetchAPI('/api/members')
      ]);
      
      setEvents(eventsData);
      setMembers(membersData);
      
      const newSubEvents: Record<string, SubEvent[]> = {};
      const newParties: Record<string, Party[]> = {};
      const newAssignments: Record<string, Assignment[]> = {};

      for (const event of eventsData) {
        const subEventsData = [...(event.subevents || [])];
        subEventsData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
        newSubEvents[event.id!] = subEventsData;
        
        for (const subEvent of subEventsData) {
          const partiesData = [...(subEvent.parties || [])];
          partiesData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
          newParties[subEvent.id!] = partiesData;
          
          for (const party of partiesData) {
            const assignmentsData = [...(party.assignments || [])];
            assignmentsData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            newAssignments[party.id!] = assignmentsData;
          }
        }
      }

      setSubEvents(newSubEvents);
      setParties(newParties);
      setAssignments(newAssignments);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load events data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        await fetchAPI(`/api/events/${editingEvent.id}`, {
          method: 'PUT',
          body: JSON.stringify(eventFormData)
        });
      } else {
        await fetchAPI('/api/events', {
          method: 'POST',
          body: JSON.stringify(eventFormData)
        });
      }
      closeEventModal();
      loadData();
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  };

  const handleSubEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEventId) return;
    try {
      if (editingSubEvent) {
        await fetchAPI(`/api/events/${activeEventId}/subevents/${editingSubEvent.id}`, {
          method: 'PUT',
          body: JSON.stringify(subEventFormData)
        });
      } else {
        const currentSubEvents = subEvents[activeEventId] || [];
        const nextOrder = currentSubEvents.length > 0 
          ? Math.max(...currentSubEvents.map(s => s.order)) + 1 
          : 0;
        await fetchAPI(`/api/events/${activeEventId}/subevents`, {
          method: 'POST',
          body: JSON.stringify({
            ...subEventFormData,
            order: nextOrder
          })
        });
      }
      setIsSubEventModalOpen(false);
      setEditingSubEvent(null);
      setSubEventFormData({ name: '' });
      loadData();
    } catch (error) {
      console.error('Failed to save sub-event:', error);
    }
  };

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEventId || !activeSubEventId) return;
    try {
      if (editingParty) {
        await fetchAPI(`/api/events/${activeEventId}/subevents/${activeSubEventId}/parties/${editingParty.id}`, {
          method: 'PUT',
          body: JSON.stringify(partyFormData)
        });
      } else {
        const currentParties = parties[activeSubEventId] || [];
        const nextOrder = currentParties.length > 0 
          ? Math.max(...currentParties.map(p => p.order ?? 0)) + 1 
          : 0;
        await fetchAPI(`/api/events/${activeEventId}/subevents/${activeSubEventId}/parties`, {
          method: 'POST',
          body: JSON.stringify({
            ...partyFormData,
            eventId: activeEventId,
            subEventId: activeSubEventId,
            order: nextOrder
          })
        });
      }
      setIsPartyModalOpen(false);
      setEditingParty(null);
      setPartyFormData({ name: '' });
      loadData();
    } catch (error) {
      console.error('Failed to save party:', error);
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

    const nextOrder = currentAssignments.length;
    const newAssignment = {
      id: 'temp-' + Date.now(),
      memberId: assignFormData.memberId,
      role: assignFormData.role,
      eventId: activeEventId,
      subEventId: activeSubEventId,
      partyId: activePartyId,
      order: nextOrder
    };

    // Optimistic update
    setAssignments(prev => ({
      ...prev,
      [activePartyId]: [...(prev[activePartyId] || []), newAssignment]
    }));
    setIsAssignModalOpen(false);
    setAssignFormData({ memberId: '', role: ROLES[0].name });

    try {
      await fetchAPI(`/api/events/${activeEventId}/subevents/${activeSubEventId}/parties/${activePartyId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          memberId: assignFormData.memberId,
          role: assignFormData.role,
          eventId: activeEventId,
          subEventId: activeSubEventId,
          partyId: activePartyId,
          order: nextOrder
        })
      });
      loadData();
    } catch (error) {
      console.error('Failed to assign member:', error);
      loadData(); // Rollback
    }
  };

  const unassignMember = async (eventId: string, subEventId: string, partyId: string, assignmentId: string) => {
    // Optimistic update
    setAssignments(prev => ({
      ...prev,
      [partyId]: (prev[partyId] || []).filter(a => a.id !== assignmentId)
    }));

    try {
      await fetchAPI(`/api/events/${eventId}/subevents/${subEventId}/parties/${partyId}/assignments/${assignmentId}`, {
        method: 'DELETE'
      });
      loadData();
    } catch (error) {
      console.error('Failed to unassign member:', error);
      loadData(); // Rollback
    }
  };

  const deleteParty = async (eventId: string, subEventId: string, partyId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Party',
      message: 'Are you sure you want to delete this party and all its assignments? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await fetchAPI(`/api/events/${eventId}/subevents/${subEventId}/parties/${partyId}`, {
            method: 'DELETE'
          });
          loadData();
        } catch (error) {
          console.error('Failed to delete party:', error);
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
          await fetchAPI(`/api/events/${eventId}/subevents/${subEventId}`, {
            method: 'DELETE'
          });
          loadData();
        } catch (error) {
          console.error('Failed to delete sub-event:', error);
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
          await fetchAPI(`/api/events/${id}`, {
            method: 'DELETE'
          });
          loadData();
        } catch (error) {
          console.error('Failed to delete event:', error);
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

    const newSubEvents = [...eventSubEvents];
    const [moved] = newSubEvents.splice(index, 1);
    newSubEvents.splice(newIndex, 0, moved);

    // Update orders
    newSubEvents.forEach((s, i) => s.order = i);

    // Optimistic update
    setSubEvents(prev => ({ ...prev, [eventId]: newSubEvents }));

    try {
      await fetchAPI(`/api/events/${eventId}/subevents-reorder`, {
        method: 'PUT',
        body: JSON.stringify({ subevents: newSubEvents })
      });
      loadData();
    } catch (error) {
      console.error('Failed to reorder subevents:', error);
      loadData(); // Rollback
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;
    if (activeData?.type === 'party') {
      setInitialSubEventId(activeData.subEventId);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || activeData.type !== 'party') return;

    // Find current container in state
    const activeSubEventId = Object.keys(parties).find(key => 
      parties[key].some(p => p.id === active.id)
    );
    
    const overSubEventId = overData?.subEventId || (overData?.type === 'subEvent' ? over.id : null);

    if (activeSubEventId && overSubEventId && activeSubEventId !== overSubEventId) {
      setParties(prev => {
        const activeItems = prev[activeSubEventId] || [];
        const overItems = prev[overSubEventId] || [];
        const activeIndex = activeItems.findIndex(p => p.id === active.id);
        
        let newIndex;
        if (overData?.type === 'party') {
          newIndex = overItems.findIndex(p => p.id === over.id);
        } else {
          newIndex = overItems.length;
        }

        const item = activeItems[activeIndex];
        if (!item) return prev;

        const nextActiveItems = [...activeItems];
        nextActiveItems.splice(activeIndex, 1);

        const nextOverItems = [...overItems];
        nextOverItems.splice(newIndex, 0, { ...item, subEventId: overSubEventId });

        return {
          ...prev,
          [activeSubEventId]: nextActiveItems,
          [overSubEventId]: nextOverItems,
        };
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent, eventId: string) => {
    const { active, over } = event;
    if (!over) {
      setInitialSubEventId(null);
      return;
    }

    const activeData = active.data.current;
    
    if (activeData?.type === 'subEvent') {
      if (active.id === over.id) {
        setInitialSubEventId(null);
        return;
      }
      
      const eventSubEvents = [...(subEvents[eventId] || [])];
      const oldIndex = eventSubEvents.findIndex((s) => s.id === active.id);
      const newIndex = eventSubEvents.findIndex((s) => s.id === over.id);

      const reordered = arrayMove(eventSubEvents, oldIndex, newIndex).map((s, index) => ({
        ...s,
        order: index
      }));
      
      setSubEvents(prev => ({ ...prev, [eventId]: reordered }));

      try {
        await fetchAPI(`/api/events/${eventId}/subevents-reorder`, {
          method: 'PUT',
          body: JSON.stringify({ subevents: reordered })
        });
        loadData();
      } catch (error) {
        console.error('Failed to reorder subevents:', error);
      }
    } else if (activeData?.type === 'party') {
      // Find where it ended up in our state
      const currentSubEventId = Object.keys(parties).find(key => 
        parties[key].some(p => p.id === active.id)
      );

      if (initialSubEventId && currentSubEventId) {
        const currentParties = parties[currentSubEventId] || [];
        const finalIndex = currentParties.findIndex(p => p.id === active.id);

        if (initialSubEventId === currentSubEventId) {
          // Reorder within same container
          const oldIndex = currentParties.findIndex(p => p.id === active.id);
          const overIndex = currentParties.findIndex(p => p.id === over.id);
          
          if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
            const reordered = arrayMove(currentParties, oldIndex, overIndex);
            handlePartyReorder(eventId, currentSubEventId, reordered);
          }
        } else {
          // Cross-container move
          try {
            await fetchAPI(`/api/events/${eventId}/move-party`, {
              method: 'PUT',
              body: JSON.stringify({
                partyId: active.id,
                fromSubEventId: initialSubEventId,
                toSubEventId: currentSubEventId,
                newIndex: finalIndex
              })
            });
            loadData();
          } catch (error) {
            console.error('Failed to move party:', error);
            loadData();
          }
        }
      }
    }
    setInitialSubEventId(null);
  };

  const handlePartyReorder = async (eventId: string, subEventId: string, reorderedParties: Party[]) => {
    const reorderedWithOrder = reorderedParties.map((p, index) => ({
      ...p,
      order: index
    }));

    // Update state immediately for smooth UI
    setParties(prev => ({ ...prev, [subEventId]: reorderedWithOrder }));

    // Update Firestore orders
    try {
      await fetchAPI(`/api/events/${eventId}/subevents/${subEventId}/parties-reorder`, {
        method: 'PUT',
        body: JSON.stringify({ parties: reorderedWithOrder })
      });
      loadData();
    } catch (error) {
      console.error('Failed to reorder parties:', error);
    }
  };

  const handleAssignmentReorder = async (eventId: string, subEventId: string, partyId: string, reorderedAssignments: Assignment[]) => {
    const reorderedWithOrder = reorderedAssignments.map((a, index) => ({
      ...a,
      order: index
    }));

    // Update state immediately for smooth UI
    setAssignments(prev => ({ ...prev, [partyId]: reorderedWithOrder }));

    // Update Firestore orders
    try {
      await fetchAPI(`/api/events/${eventId}/subevents/${subEventId}/parties/${partyId}/assignments-reorder`, {
        method: 'PUT',
        body: JSON.stringify({ assignments: reorderedWithOrder })
      });
      loadData();
    } catch (error) {
      console.error('Failed to reorder assignments:', error);
    }
  };

  const openEventModal = (event?: GuildEvent) => {
    if (event) {
      setEditingEvent(event);
      setEventFormData({ 
        name: event.name, 
        description: event.description || '',
        instructions: event.instructions || ''
      });
    } else {
      setEditingEvent(null);
      setEventFormData({ name: '', description: '', instructions: '' });
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
    return ROLES.find(r => r.name === roleName) || ROLES[0];
  };

  const getAutoRole = (member: Member) => {
    return getMemberCategory(member);
  };

  const filteredMembersForAssign = members
    .filter(m => {
      // Filter out members already assigned to ANY party in ANY sub-event of the current event
      const eventSubEvents = subEvents[activeEventId!] || [];
      const assignedMemberIds = eventSubEvents
        .flatMap(se => parties[se.id!] || [])
        .flatMap(p => assignments[p.id!] || [])
        .map(a => a.memberId);
      return !assignedMemberIds.includes(m.id!);
    })
    .filter(m => {
      // Search term filter
      if (!memberSearchTerm) return true;
      const ign = m.ign || '';
      const job = m.job || '';
      return ign.toLowerCase().includes(memberSearchTerm.toLowerCase()) || 
             job.toLowerCase().includes(memberSearchTerm.toLowerCase());
    })
    .filter(m => {
      // Role filter
      if (memberRoleFilter === 'All') return true;
      return getMemberCategory(m) === memberRoleFilter;
    });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
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
                    {event.instructions && (
                      <div className="mt-3 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                        <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Zap className="w-3 h-3" />
                          Instructions / Notes
                        </p>
                        <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                          {event.instructions}
                        </p>
                      </div>
                    )}
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
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
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
                              onReorderParties={handlePartyReorder}
                              onReorderAssignments={handleAssignmentReorder}
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

                      {/* Absent Members Section */}
                      {(() => {
                        const eventSubEvents = subEvents[event.id!] || [];
                        const assignedMemberIds = new Set<string>();
                        eventSubEvents.forEach(se => {
                          const subEventParties = parties[se.id!] || [];
                          subEventParties.forEach(p => {
                            const partyAssignments = assignments[p.id!] || [];
                            partyAssignments.forEach(a => {
                              assignedMemberIds.add(a.memberId);
                            });
                          });
                        });
                        const absentMembers = members.filter(m => !assignedMemberIds.has(m.id!));

                        if (absentMembers.length === 0) return null;

                        return (
                          <div className="mt-8 pt-8 border-t border-zinc-800/50">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500">
                                  <UserMinus className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-sm uppercase tracking-wider">Absent / Unassigned Members</h4>
                                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">
                                    {absentMembers.length} {absentMembers.length === 1 ? 'Member' : 'Members'} not in any party
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                              {absentMembers.map(m => (
                                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-zinc-800 shrink-0">
                                    {getJobIcon(m)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-zinc-300 truncate">{m.ign}</p>
                                    <p className="text-[9px] text-zinc-600 truncate uppercase font-bold">{m.job}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
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
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Instructions / Notes (Visible Publicly)</label>
                  <textarea value={eventFormData.instructions} onChange={(e) => setEventFormData({ ...eventFormData, instructions: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 px-4 text-white h-32 resize-none" placeholder="Add specific instructions for this event..." />
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
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-h-[90vh] flex flex-col">
              <h2 className="text-2xl font-bold text-white mb-6">Assign to {parties[activeSubEventId!]?.find(p => p.id === activePartyId)?.name}</h2>
              
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Search & Filter Members</label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search name or job..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      value={memberSearchTerm}
                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-1 mb-4">
                    {['All', 'DPS', 'Support', 'Tank'].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setMemberRoleFilter(filter as any)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                          memberRoleFilter === filter 
                            ? "bg-orange-500/10 text-orange-500 border-orange-500/20" 
                            : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 min-h-[200px]">
                  {filteredMembersForAssign.length === 0 ? (
                    <div className="py-8 text-center text-zinc-600 text-sm italic">
                      No members found
                    </div>
                  ) : (
                    filteredMembersForAssign.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setAssignFormData({ 
                            ...assignFormData, 
                            memberId: m.id!,
                            role: getAutoRole(m)
                          });
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
                          assignFormData.memberId === m.id 
                            ? "bg-orange-500/10 border-orange-500/50" 
                            : "bg-zinc-800/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800"
                        )}
                      >
                        <div>
                          <p className="font-bold text-white text-sm group-hover:text-orange-500 transition-colors">{m.ign}</p>
                          <p className="text-xs text-zinc-500">{m.job}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
                            getMemberCategory(m) === 'Support' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                            getMemberCategory(m) === 'Tank' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                            "bg-zinc-700 text-zinc-400 border-zinc-600"
                          )}>
                            {getMemberCategory(m)}
                          </span>
                          {assignFormData.memberId === m.id && <Check className="w-4 h-4 text-orange-500" />}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <form onSubmit={handleAssignSubmit} className="space-y-4 pt-4 border-t border-zinc-800">
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsAssignModalOpen(false);
                        setMemberSearchTerm('');
                        setMemberRoleFilter('All');
                      }} 
                      className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={!assignFormData.memberId}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Assign
                    </button>
                  </div>
                </form>
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
        variant={confirmModal.variant}
      />
    </div>
  );
}
