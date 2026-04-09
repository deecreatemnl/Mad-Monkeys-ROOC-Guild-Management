import { useState, useEffect, useCallback, useMemo, memo, createContext, useContext } from 'react';
import { fetchAPI } from '../lib/api';
import { GuildEvent, Member, Assignment, Party, SubEvent } from '../types';
import { Plus, Edit2, Trash2, X, Users, UserPlus, UserMinus, Info, LayoutGrid, Clock, Shield, Sword, Heart, Star, Share2, Check, Copy, Layers, ChevronUp, ChevronDown, ChevronRight, GripVertical, Search, Zap, Target, Music, Hammer, FlaskConical, Hand, Cross, Skull, MessageSquare, Loader2, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { io } from 'socket.io-client';
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

const getMemberCategory = (member: Member) => {
  if (member.role) return member.role;
  
  const job = member.job || '';
  const supports = ['Gypsy', 'Minstrel', 'High Priest', 'Minstrel (M)', 'Gypsy (F)'];
  const tanks = ['Paladin'];
  
  if (supports.includes(job)) return 'Support';
  if (tanks.includes(job)) return 'Tank';
  return 'DPS';
};

const getJobIcon = (member: Member, roles: any[]) => {
  const job = member.job || '';
  const j = job.toLowerCase();
  const category = getMemberCategory(member);
  const role = roles.find(r => r.name === category);
  const colorHex = role ? role.color : '#a1a1aa';
  
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
  
  return <div style={{ color: colorHex }}>{icon}</div>;
};

interface EventsPageProps {
  isAdmin?: boolean;
}

// Contexts for performance optimization
const EventsActionsContext = createContext<any>(null);
const EventsStaticDataContext = createContext<any>(null);

interface SortableAssignmentItemProps {
  assignment: Assignment;
  member: Member | undefined;
  roleStyle: any;
}

const SortableAssignmentItem = memo(({
  assignment,
  member,
  roleStyle,
}: SortableAssignmentItemProps) => {
  const { isAdmin, unassignMember } = useContext(EventsActionsContext);
  const { roles } = useContext(EventsStaticDataContext);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: assignment.id!,
    data: {
      type: 'assignment',
      assignment,
      partyId: assignment.partyId,
      subEventId: assignment.subEventId,
      eventId: assignment.eventId
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center justify-between p-2 rounded-lg group bg-zinc-900/50 border border-zinc-800/50", isDragging && "opacity-50 z-50")}>
      <div className="flex items-center gap-3">
        {isAdmin && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-800">
          {member ? getJobIcon(member, roles) : <Star className="w-4 h-4 text-zinc-500" />}
        </div>
        <div>
          <p className="text-sm font-bold leading-none text-white">{member?.ign}</p>
          <div className="flex items-center gap-2 mt-1">
            <div 
              className="flex items-center gap-1 text-[9px] font-bold uppercase"
              style={{ color: roleStyle.color }}
            >
              {roleStyle.icon}
              {assignment.role}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">• {member?.job}</span>
          </div>
        </div>
      </div>
      {isAdmin && (
        <button
          onClick={() => unassignMember(assignment.eventId!, assignment.subEventId!, assignment.partyId!, assignment.id!)}
          className="p-1 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
        >
          <UserMinus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});
SortableAssignmentItem.displayName = 'SortableAssignmentItem';

interface SortablePartyItemProps {
  party: Party;
  eventId: string;
  subEventId: string;
  partyAssignments: Assignment[];
}

const SortablePartyItem = memo(({
  party,
  eventId,
  subEventId,
  partyAssignments,
}: SortablePartyItemProps) => {
  const { 
    isAdmin, 
    openAssignModal, 
    openPartyModal, 
    deleteParty 
  } = useContext(EventsActionsContext);
  const { members, getRoleStyle } = useContext(EventsStaticDataContext);

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
      subEventId,
      eventId,
      party
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  const assignmentIds = useMemo(() => partyAssignments.map(a => a.id!), [partyAssignments]);

  return (
    <div ref={setNodeRef} style={style} className={cn("bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full", isDragging && "opacity-50 z-40")}>
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
            {partyAssignments.length || 0}/{party.maxSize || 12}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <>
              <button
                onClick={() => openAssignModal(eventId, subEventId, party.id!)}
                className="p-1.5 text-zinc-400 hover:text-orange-500 transition-colors"
                title="Assign Member"
              >
                <UserPlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => openPartyModal(eventId, subEventId, party)}
                className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                title="Edit Party Name"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteParty(eventId, subEventId, party.id!)}
                className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-3">
        <SortableContext
          id={`party-${party.id}`}
          items={assignmentIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {partyAssignments.map((assignment) => {
              const member = members.find((m: any) => m.id === assignment.memberId);
              const roleStyle = getRoleStyle(assignment.role);
              return (
                <SortableAssignmentItem
                  key={assignment.id}
                  assignment={assignment}
                  member={member}
                  roleStyle={roleStyle}
                />
              );
            })}
            {partyAssignments.length === 0 && (
              <div className="py-4 text-center text-zinc-700 text-xs italic">
                Empty Party
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
});
SortablePartyItem.displayName = 'SortablePartyItem';

interface SortableSubEventItemProps {
  subEvent: SubEvent;
  eventId: string;
  subEventParties: Party[];
  partyAssignmentsMap: Record<string, Assignment[]>;
}

const SortableSubEventItem = memo(({
  subEvent,
  eventId,
  subEventParties,
  partyAssignmentsMap,
}: SortableSubEventItemProps) => {
  const { 
    isAdmin, 
    collapsedSubEvents, 
    toggleSubEventCollapse,
    openPartyModal,
    openSubEventModal,
    deleteSubEvent
  } = useContext(EventsActionsContext);

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
      eventId,
      subEvent
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : 1,
  };

  const partyIds = useMemo(() => subEventParties.map(p => p.id!), [subEventParties]);
  const isCollapsed = collapsedSubEvents.has(subEvent.id!);

  return (
    <div ref={setNodeRef} style={style} className={cn("space-y-4", isDragging && "opacity-50 z-30")}>
      <div className="flex items-center justify-between bg-zinc-800/30 p-3 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <button 
            onClick={() => toggleSubEventCollapse(subEvent.id!)}
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
                onClick={() => openPartyModal(eventId, subEvent.id!)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Party
              </button>
              <button
                onClick={() => openSubEventModal(eventId, subEvent)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteSubEvent(eventId, subEvent.id!)}
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
              items={partyIds}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {subEventParties.map((party) => (
                  <SortablePartyItem
                    key={party.id}
                    party={party}
                    eventId={eventId}
                    subEventId={subEvent.id!}
                    partyAssignments={partyAssignmentsMap[party.id!] || []}
                  />
                ))}
                {subEventParties.length === 0 && (
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
});
SortableSubEventItem.displayName = 'SortableSubEventItem';

interface SortableEventItemProps {
  event: GuildEvent;
  eventSubEvents: SubEvent[];
  partiesMap: Record<string, Party[]>;
  assignmentsMap: Record<string, Assignment[]>;
}

const SortableEventItem = memo(({
  event,
  eventSubEvents,
  partiesMap,
  assignmentsMap,
}: SortableEventItemProps) => {
  const { 
    isAdmin, 
    collapsedEvents, 
    toggleEventCollapse,
    expandedInstructions,
    toggleInstructions,
    handleShare,
    copiedId,
    openDiscordShareModal,
    openSubEventModal,
    openEventModal,
    deleteEvent
  } = useContext(EventsActionsContext);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: event.id!,
    data: {
      type: 'event',
      event
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
  };

  const subEventIds = useMemo(() => eventSubEvents.map(s => s.id!), [eventSubEvents]);

  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        layout
        className={cn("bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden", isDragging && "opacity-50 ring-2 ring-orange-500/50")}
      >
        <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50">
          <div className="flex items-start gap-4 flex-1">
            <div className="flex flex-col gap-2">
              {isAdmin && (
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 p-1">
                  <GripVertical className="w-5 h-5" />
                </div>
              )}
              <button 
                onClick={() => toggleEventCollapse(event.id!)}
                className="text-zinc-500 hover:text-white transition-colors p-1"
              >
                {collapsedEvents.has(event.id!) ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{event.name}</h3>
              <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-1">
                <Info className="w-3.5 h-3.5" />
                {event.description || 'Regular weekly event'}
              </p>
              {event.schedule && event.schedule.length > 0 && (
                <p className="text-xs text-orange-500/80 flex items-center gap-1.5 mt-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Recurring: {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                    .filter((_, i) => event.schedule?.includes(i))
                    .join(', ')}
                </p>
              )}
              {event.instructions && (
                <div className="mt-3 bg-orange-500/5 border border-orange-500/10 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => toggleInstructions(event.id!)}
                    className="w-full p-3 flex items-center justify-between hover:bg-orange-500/10 transition-colors"
                  >
                    <p className="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3 h-3" />
                      Instructions / Notes
                    </p>
                    {expandedInstructions.has(event.id!) ? <ChevronUp className="w-3 h-3 text-orange-500" /> : <ChevronDown className="w-3 h-3 text-orange-500" />}
                  </button>
                  <AnimatePresence>
                    {expandedInstructions.has(event.id!) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-3 pb-3"
                      >
                        <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap pt-1 border-t border-orange-500/10">
                          {event.instructions}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                  onClick={() => openDiscordShareModal(event)}
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send to Discord
                </button>
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
              <div className="p-6 space-y-6">
                <SortableContext
                  items={subEventIds}
                  strategy={verticalListSortingStrategy}
                >
                  {eventSubEvents.map((subEvent) => (
                    <SortableSubEventItem
                      key={subEvent.id}
                      subEvent={subEvent}
                      eventId={event.id!}
                      subEventParties={partiesMap[subEvent.id!] || []}
                      partyAssignmentsMap={assignmentsMap}
                    />
                  ))}
                </SortableContext>
                {eventSubEvents.length === 0 && (
                  <div className="py-12 text-center border-2 border-dashed border-zinc-800 rounded-2xl">
                    <div className="w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-600">
                      <Layers className="w-6 h-6" />
                    </div>
                    <h4 className="text-zinc-400 font-medium">No sub events yet</h4>
                    <p className="text-zinc-600 text-sm mt-1">Create sub events to start organizing parties</p>
                    {isAdmin && (
                      <button
                        onClick={() => openSubEventModal(event.id!)}
                        className="mt-4 text-orange-500 hover:text-orange-400 text-sm font-bold uppercase tracking-wider"
                      >
                        + Add Sub Event
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});
SortableEventItem.displayName = 'SortableEventItem';

export default function EventsPage({ isAdmin = false }: EventsPageProps) {
  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [removingAbsence, setRemovingAbsence] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
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
  
  const [collapsedEvents, setCollapsedEvents] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('collapsedEvents');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [collapsedSubEvents, setCollapsedSubEvents] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('collapsedSubEvents');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [expandedInstructions, setExpandedInstructions] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem('collapsedEvents', JSON.stringify(Array.from(collapsedEvents)));
  }, [collapsedEvents]);

  useEffect(() => {
    localStorage.setItem('collapsedSubEvents', JSON.stringify(Array.from(collapsedSubEvents)));
  }, [collapsedSubEvents]);
  
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<'All' | 'DPS' | 'Support' | 'Tank' | 'Utility'>('All');
  const [initialSubEventId, setInitialSubEventId] = useState<string | null>(null);

  const [isDiscordShareModalOpen, setIsDiscordShareModalOpen] = useState(false);
  const [discordShareMessage, setDiscordShareMessage] = useState('');
  const [activeEventForDiscord, setActiveEventForDiscord] = useState<GuildEvent | null>(null);
  const [isSendingDiscord, setIsSendingDiscord] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
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

  const toggleInstructions = (id: string) => {
    setExpandedInstructions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const [roles, setRoles] = useState<any[]>([]);
  const [eventFormData, setEventFormData] = useState({ name: '', description: '', instructions: '', schedule: [] as number[] });
  const [subEventFormData, setSubEventFormData] = useState({ name: '' });
  const [partyFormData, setPartyFormData] = useState({ name: '' });
  const [assignFormData, setAssignFormData] = useState({ memberId: '', role: roles[0]?.name || '' });

  const [settings, setSettings] = useState<any>(null);

  const handleRemoveAbsence = async (eventId: string, memberId: string) => {
    console.log(`[handleRemoveAbsence] EventID: ${eventId}, MemberID: ${memberId}`);
    setConfirmModal({
      isOpen: true,
      title: 'Make Player Available',
      message: 'Are you sure you want to make this player available again? This will remove their absence record for this event.',
      variant: 'info',
      onConfirm: async () => {
        console.log(`[handleRemoveAbsence] Confirmed. Removing absence for ${memberId} in event ${eventId}`);
        setRemovingAbsence(memberId);
        try {
          const result = await fetchAPI(`/api/events/${eventId}/absent/${memberId}`, { method: 'DELETE' });
          console.log('[handleRemoveAbsence] API Result:', result);
          // Refresh data to update the UI
          await loadData();
          console.log('[handleRemoveAbsence] Data reloaded');
        } catch (error) {
          console.error('Error removing absence:', error);
        } finally {
          setRemovingAbsence(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const loadData = useCallback(async () => {
    try {
      const [eventsData, membersData, settingsData, jobsData, rolesData] = await Promise.all([
        fetchAPI('/api/events'),
        fetchAPI('/api/members'),
        fetchAPI('/api/settings/guild_settings'),
        fetchAPI('/api/jobs'),
        fetchAPI('/api/roles')
      ]);
      
      // Sort by order if available, otherwise newest first (by ID descending)
      const sortedEvents = [...eventsData].sort((a: any, b: any) => {
        if (a.order !== undefined && b.order !== undefined && a.order !== null && b.order !== null) {
          return a.order - b.order;
        }
        return (b.id || '').localeCompare(a.id || '');
      });
      console.log('[loadData] Sorted events:', sortedEvents.map(e => ({ id: e.id, name: e.name, order: e.order })));
      setEvents(sortedEvents);
      setMembers(membersData);
      setSettings(settingsData);
      setJobs(jobsData || []);
      setRoles(rolesData || []);
      
      const newSubEvents: Record<string, SubEvent[]> = {};
      const newParties: Record<string, Party[]> = {};
      const newAssignments: Record<string, Assignment[]> = {};

      for (const event of sortedEvents) {
        const subEventsData = [...(event.subevents || [])];
        subEventsData.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
        newSubEvents[event.id!] = subEventsData;
        
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
    const socket = io();
    
    socket.on('update', (data) => {
      console.log('Real-time update received:', data);
      if (['events', 'members', 'roles', 'jobs', 'settings'].includes(data.type)) {
        loadData();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [shareLinks, setShareLinks] = useState<Record<string, any[]>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeShareEventId, setActiveShareEventId] = useState<string | null>(null);

  const handleShare = async (eventId: string) => {
    setActiveShareEventId(eventId);
    setIsShareModalOpen(true);
    await loadShareLinks(eventId);
  };

  const loadShareLinks = async (eventId: string) => {
    try {
      const links = await fetchAPI(`/api/events/${eventId}/share-links`);
      setShareLinks(prev => ({ ...prev, [eventId]: links }));
    } catch (error) {
      console.error('Failed to load share links:', error);
    }
  };

  const generateShareLink = async (eventId: string) => {
    try {
      const newLink = await fetchAPI(`/api/events/${eventId}/share-links`, {
        method: 'POST'
      });
      setShareLinks(prev => ({
        ...prev,
        [eventId]: [...(prev[eventId] || []), newLink]
      }));
    } catch (error: any) {
      alert(error.message || 'Failed to generate share link');
    }
  };

  const deleteShareLink = async (eventId: string, linkId: string) => {
    try {
      await fetchAPI(`/api/events/${eventId}/share-links/${linkId}`, {
        method: 'DELETE'
      });
      setShareLinks(prev => ({
        ...prev,
        [eventId]: (prev[eventId] || []).filter(l => l.id !== linkId)
      }));
    } catch (error) {
      console.error('Failed to delete share link:', error);
    }
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/public/event/link/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openDiscordShareModal = (event: GuildEvent) => {
    setActiveEventForDiscord(event);
    const url = `${window.location.origin}/public/event/${event.id}`;
    setDiscordShareMessage(`Hey @everyone! The lineup for **${event.name}** is ready. Check it out here: {link}`);
    setIsDiscordShareModalOpen(true);
  };

  const handleDiscordShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEventForDiscord) return;
    
    setIsSendingDiscord(true);
    try {
      const url = `${window.location.origin}/public/event/${activeEventForDiscord.id}`;
      const finalMessage = discordShareMessage.replace('{link}', url);
      
      await fetchAPI(`/api/events/${activeEventForDiscord.id}/share-discord`, {
        method: 'POST',
        body: JSON.stringify({ message: finalMessage })
      });
      
      setIsDiscordShareModalOpen(false);
    } catch (error) {
      console.error('Failed to share to Discord:', error);
      alert('Failed to share to Discord. Please check your integration settings.');
    } finally {
      setIsSendingDiscord(false);
    }
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting event form data:', eventFormData);
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
    
    // Check member limit
    const currentAssignments = assignments[activePartyId] || [];
    const party = parties[activeSubEventId!]?.find(p => p.id === activePartyId);
    const maxSize = party?.maxSize || settings?.maxPartySize || 12;
    
    if (currentAssignments.length >= maxSize) {
      alert(`Party is full! Maximum ${maxSize} members allowed.`);
      return;
    }

    const member = members.find(m => m.id === assignFormData.memberId);
    const nextOrder = currentAssignments.length;
    const tempId = 'temp-' + Date.now();
    const newAssignment = {
      id: tempId,
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
    setAssignFormData({ memberId: '', role: roles[0]?.name || '' });

    try {
      const result = await fetchAPI(`/api/events/${activeEventId}/subevents/${activeSubEventId}/parties/${activePartyId}/assignments`, {
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
      
      // Update the temp ID with the real ID from server to avoid "ghosting" or jumping
      setAssignments(prev => ({
        ...prev,
        [activePartyId]: (prev[activePartyId] || []).map(a => a.id === tempId ? result : a)
      }));
    } catch (error) {
      console.error('Failed to assign member:', error);
      loadData(); // Rollback on error
    }
  };

  const unassignMember = async (eventId: string, subEventId: string, partyId: string, assignmentId: string) => {
    // Optimistic update
    const originalAssignments = assignments[partyId];
    setAssignments(prev => ({
      ...prev,
      [partyId]: (prev[partyId] || []).filter(a => a.id !== assignmentId)
    }));

    try {
      await fetchAPI(`/api/events/${eventId}/subevents/${subEventId}/parties/${partyId}/assignments/${assignmentId}`, {
        method: 'DELETE'
      });
      // No need to reload everything if successful
    } catch (error) {
      console.error('Failed to unassign member:', error);
      // Rollback
      setAssignments(prev => ({
        ...prev,
        [partyId]: originalAssignments
      }));
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

  const handlePartyReorder = useCallback(async (eventId: string, subEventId: string, reorderedParties: Party[]) => {
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
    } catch (error) {
      console.error('Failed to reorder parties:', error);
      loadData();
    }
  }, [loadData]);

  const handleAssignmentReorder = useCallback(async (eventId: string, subEventId: string, partyId: string, reorderedAssignments: Assignment[]) => {
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
    } catch (error) {
      console.error('Failed to reorder assignments:', error);
      loadData();
    }
  }, [loadData]);

  const handleDragEndTop = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setInitialSubEventId(null);
      return;
    }

    const activeData = active.data.current;
    
    if (activeData?.type === 'event') {
      const oldIndex = events.findIndex((e) => e.id === active.id);
      const newIndex = events.findIndex((e) => e.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(events, oldIndex, newIndex);
        setEvents(reordered);

        try {
          await fetchAPI('/api/events-reorder', {
            method: 'PUT',
            body: JSON.stringify({ orderedIds: reordered.map(e => e.id) })
          });
        } catch (error) {
          console.error('Failed to reorder events:', error);
          loadData();
        }
      }
    } else if (activeData?.type === 'subEvent') {
      const eventId = activeData.eventId;
      if (!eventId) return;
      
      const eventSubEvents = [...(subEvents[eventId] || [])];
      const oldIndex = eventSubEvents.findIndex((s) => s.id === active.id);
      const newIndex = eventSubEvents.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
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
        } catch (error) {
          console.error('Failed to reorder subevents:', error);
          loadData();
        }
      }
    } else if (activeData?.type === 'assignment') {
      const currentPartyId = activeData.partyId;
      const eventId = activeData.eventId;
      const subEventId = activeData.subEventId;
      
      if (currentPartyId && eventId && subEventId) {
        const currentAssignments = assignments[currentPartyId] || [];
        const oldIndex = currentAssignments.findIndex(a => a.id === active.id);
        const overIndex = currentAssignments.findIndex(a => a.id === over.id);
        
        if (oldIndex !== -1 && overIndex !== -1) {
          const reordered = arrayMove(currentAssignments, oldIndex, overIndex);
          handleAssignmentReorder(eventId, subEventId, currentPartyId, reordered);
        }
      }
    } else if (activeData?.type === 'party') {
      const currentSubEventId = activeData.subEventId;
      const eventId = activeData.eventId;

      if (initialSubEventId && currentSubEventId && initialSubEventId === currentSubEventId && eventId) {
        const currentParties = parties[currentSubEventId] || [];
        const oldIndex = currentParties.findIndex(p => p.id === active.id);
        const overIndex = currentParties.findIndex(p => p.id === over.id);
        
        if (oldIndex !== -1 && overIndex !== -1) {
          const reordered = arrayMove(currentParties, oldIndex, overIndex);
          handlePartyReorder(eventId, currentSubEventId, reordered);
        }
      }
    }
    setInitialSubEventId(null);
  }, [events, subEvents, assignments, parties, initialSubEventId, handleAssignmentReorder, handlePartyReorder, loadData]);

  const openEventModal = (event?: GuildEvent) => {
    if (event) {
      setEditingEvent(event);
      setEventFormData({ 
        name: event.name, 
        description: event.description || '',
        instructions: event.instructions || '',
        schedule: event.schedule || []
      });
    } else {
      setEditingEvent(null);
      setEventFormData({ name: '', description: '', instructions: '', schedule: [] });
    }
    setIsEventModalOpen(true);
  };

  const closeEventModal = () => {
    setIsEventModalOpen(false);
    setEditingEvent(null);
    setEventFormData({ name: '', description: '', instructions: '', schedule: [] });
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

  const getRoleStyle = useCallback((roleName: string) => {
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
  }, [roles]);

  const getAutoRole = (member: Member) => {
    return getMemberCategory(member);
  };

  const filteredMembersForAssign = useMemo(() => {
    if (!activeEventId) return [];
    
    // Filter out members already assigned to ANY party in ANY sub-event of the current event
    const eventSubEvents = subEvents[activeEventId] || [];
    const assignedMemberIds = new Set(
      eventSubEvents
        .flatMap(se => parties[se.id!] || [])
        .flatMap(p => assignments[p.id!] || [])
        .map(a => a.memberId)
    );

    return members
      .filter(m => !assignedMemberIds.has(m.id!))
      .filter(m => {
        // Filter out inactive/busy/left members
        const status = m.status || 'active';
        return status === 'active';
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
  }, [members, subEvents, parties, assignments, activeEventId, memberSearchTerm, memberRoleFilter]);

  return (
    <EventsActionsContext.Provider value={{
      isAdmin,
      collapsedEvents,
      toggleEventCollapse,
      expandedInstructions,
      toggleInstructions,
      handleShare,
      copiedId,
      openDiscordShareModal,
      openSubEventModal,
      openEventModal,
      deleteEvent,
      collapsedSubEvents,
      toggleSubEventCollapse,
      openPartyModal,
      deleteSubEvent,
      openAssignModal,
      unassignMember,
      deleteParty,
      handlePartyReorder,
      handleAssignmentReorder
    }}>
      <EventsStaticDataContext.Provider value={{
        members,
        jobs,
        roles,
        getRoleStyle
      }}>
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEndTop}
            >
              <SortableContext
                items={events.map(e => e.id!)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-8">
                  {events.map((event) => (
                    <SortableEventItem
                      key={event.id}
                      event={event}
                      eventSubEvents={subEvents[event.id!] || []}
                      partiesMap={parties}
                      assignmentsMap={assignments}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Recurring Schedule (Event Days)</label>
                  <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const newSchedule = eventFormData.schedule.includes(index)
                            ? eventFormData.schedule.filter(d => d !== index)
                            : [...eventFormData.schedule, index];
                          setEventFormData({ ...eventFormData, schedule: newSchedule });
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                          eventFormData.schedule.includes(index)
                            ? "bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
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
                    {['All', 'DPS', 'Support', 'Tank', 'Utility'].map((filter) => (
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
                            getMemberCategory(m) === 'Utility' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
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

      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && activeShareEventId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsShareModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                    <Share2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Share Lineup</h2>
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Manage Access Links</p>
                  </div>
                </div>
                <button onClick={() => setIsShareModalOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-zinc-400">
                    Active Links: <span className="text-white font-bold">{shareLinks[activeShareEventId]?.length || 0}/2</span>
                  </p>
                  <button
                    onClick={() => generateShareLink(activeShareEventId)}
                    disabled={shareLinks[activeShareEventId]?.length >= 2}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Generate New Link
                  </button>
                </div>

                <div className="space-y-3">
                  {shareLinks[activeShareEventId]?.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                      No active share links. Generate one to share this lineup.
                    </div>
                  ) : (
                    shareLinks[activeShareEventId]?.map(link => (
                      <div key={link.id} className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-zinc-300 truncate">
                              {`${window.location.origin}/public/event/link/${link.token}`}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            Expires: {new Date(link.expiresAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyShareLink(link.token)}
                            className="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                            title="Copy Link"
                          >
                            {copiedId === link.token ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => deleteShareLink(activeShareEventId, link.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                            title="Delete Link"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Discord Share Modal */}
      <AnimatePresence>
        {isDiscordShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDiscordShareModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#5865F2]/10 rounded-xl flex items-center justify-center text-[#5865F2]">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Share to Discord</h2>
                  <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Announcements Channel</p>
                </div>
              </div>

              <form onSubmit={handleDiscordShare} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Announcement Message</label>
                  <textarea 
                    required 
                    value={discordShareMessage} 
                    onChange={(e) => setDiscordShareMessage(e.target.value)} 
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white h-32 resize-none focus:ring-2 focus:ring-orange-500/50 outline-none" 
                    placeholder="Enter your message..."
                  />
                  <p className="mt-2 text-[10px] text-zinc-500 italic">
                    Use <span className="text-orange-500 font-bold">{'{link}'}</span> where you want the lineup URL to appear.
                  </p>
                </div>

                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/50">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Preview</p>
                  <p className="text-xs text-zinc-400 leading-relaxed break-words">
                    {discordShareMessage.replace('{link}', `${window.location.origin}/public/event/${activeEventForDiscord?.id}`)}
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsDiscordShareModalOpen(false)} 
                    className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSendingDiscord}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {isSendingDiscord ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        Send Now
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
      </EventsStaticDataContext.Provider>
    </EventsActionsContext.Provider>
  );
}
