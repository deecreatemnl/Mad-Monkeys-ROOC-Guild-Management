import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Calendar, Trophy, Activity, Clock, Briefcase, ChevronDown, ChevronUp, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAPI } from '../lib/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';

// --- Sortable Container Component ---
const SortableContainer = ({ id, title, icon: Icon, children, isCollapsed, onToggle }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden ${isDragging ? 'shadow-2xl shadow-black/50 border-zinc-700' : ''}`}
    >
      <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-colors">
            <GripVertical className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon className="w-5 h-5 text-red-500" />
            {title}
          </h2>
        </div>
        <button onClick={onToggle} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
          {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Pagination Component ---
const Pagination = ({ currentPage, totalPages, onPageChange }: any) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between p-4 border-t border-zinc-800/50 bg-zinc-900/30">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-400"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="text-xs text-zinc-500">Page {currentPage} of {totalPages}</span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-400"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState<any>({
    totalMembers: 0,
    activeEvents: 0,
    activeJobs: 0,
    recentWinners: [],
    memberLogs: [],
    membersOnLeave: []
  });
  const [loading, setLoading] = useState(true);

  // Container order and collapse state
  const [containerOrder, setContainerOrder] = useState(['activity', 'winners', 'leave']);
  const [collapsedState, setCollapsedState] = useState<Record<string, boolean>>({
    activity: false,
    winners: false,
    leave: false
  });

  // Pagination states
  const [activityPage, setActivityPage] = useState(1);
  const [winnersPage, setWinnersPage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const itemsPerPage = 5;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const summary = await fetchAPI('/api/dashboard/summary');
        
        const membersList = summary.members || [];
        const activeMembersCount = summary.totalMembers;

        // Create a map for members for faster lookup
        const membersMap = new Map(membersList.map((m: any) => [m.id, m]));

        // Process Raffle Winners
        let recentWinners: any[] = [];
        if (summary.recentWinners) {
          recentWinners = [...summary.recentWinners];
          // Sort by year, month, week descending
          recentWinners.sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            if (b.month !== a.month) return b.month - a.month;
            return b.week - a.week;
          });
        }

        // Process Member Logs
        const memberLogs = (summary.memberLogs || []).map((log: any) => {
          const member = membersMap.get(log.memberId) as any;
          return { ...log, memberIgn: member?.ign || 'Unknown' };
        });

        setStats({
          totalMembers: activeMembersCount,
          activeEvents: summary.activeEvents,
          activeJobs: summary.activeJobs,
          recentWinners,
          memberLogs,
          membersOnLeave: summary.membersOnLeave || []
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setContainerOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over!.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedState(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Pagination logic
  const paginatedActivity = stats.memberLogs.slice((activityPage - 1) * itemsPerPage, activityPage * itemsPerPage);
  const paginatedWinners = stats.recentWinners.slice((winnersPage - 1) * itemsPerPage, winnersPage * itemsPerPage);
  const paginatedLeave = stats.membersOnLeave.slice((leavePage - 1) * itemsPerPage, leavePage * itemsPerPage);

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'guild_join': return <Users className="w-4 h-4 text-green-500" />;
      case 'guild_leave': return <Users className="w-4 h-4 text-red-500" />;
      case 'job_change': return <Briefcase className="w-4 h-4 text-blue-500" />;
      case 'status_change': return <Activity className="w-4 h-4 text-yellow-500" />;
      default: return <Activity className="w-4 h-4 text-zinc-500" />;
    }
  };

  const containers = {
    activity: (
      <SortableContainer key="activity" id="activity" title="Recent Member Activity" icon={Activity} isCollapsed={collapsedState.activity} onToggle={() => toggleCollapse('activity')}>
        <div className="divide-y divide-zinc-800/50">
          {paginatedActivity.length > 0 ? (
            paginatedActivity.map((log: any) => (
              <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                <div className="mt-1 p-2 bg-zinc-800 rounded-lg">
                  {getLogIcon(log.type)}
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    <span className="text-orange-400">{log.memberIgn}</span> {log.details}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-zinc-500">No recent activity found.</div>
          )}
        </div>
        <Pagination currentPage={activityPage} totalPages={Math.ceil(stats.memberLogs.length / itemsPerPage)} onPageChange={setActivityPage} />
      </SortableContainer>
    ),
    winners: (
      <SortableContainer key="winners" id="winners" title="Weekly Raffle Winners" icon={Trophy} isCollapsed={collapsedState.winners} onToggle={() => toggleCollapse('winners')}>
        <div className="divide-y divide-zinc-800/50">
          {paginatedWinners.length > 0 ? (
            paginatedWinners.map((winner: any, index: number) => (
              <div key={index} className="p-4 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{winner.ign}</p>
                  <p className="text-sm text-zinc-400">Week {winner.week}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-zinc-500">No recent winners found.</div>
          )}
        </div>
        <Pagination currentPage={winnersPage} totalPages={Math.ceil(stats.recentWinners.length / itemsPerPage)} onPageChange={setWinnersPage} />
      </SortableContainer>
    ),
    leave: (
      <SortableContainer key="leave" id="leave" title="Members on Leave" icon={Clock} isCollapsed={collapsedState.leave} onToggle={() => toggleCollapse('leave')}>
        <div className="divide-y divide-zinc-800/50">
          {paginatedLeave.length > 0 ? (
            paginatedLeave.map((member: any) => (
              <div key={member.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                    {member.ign.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">{member.ign}</p>
                    <p className="text-sm text-zinc-400">{member.job}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
                    On Leave
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-zinc-500">No members currently on leave.</div>
          )}
        </div>
        <Pagination currentPage={leavePage} totalPages={Math.ceil(stats.membersOnLeave.length / itemsPerPage)} onPageChange={setLeavePage} />
      </SortableContainer>
    )
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-2xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total Members</p>
              <p className="text-2xl font-bold text-white">{stats.totalMembers}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-2xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Active Events</p>
              <p className="text-2xl font-bold text-white">{stats.activeEvents}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-2xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Active Job Classes</p>
              <p className="text-2xl font-bold text-white">{stats.activeJobs}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Draggable Containers */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={containerOrder} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {containerOrder.map((id) => (
              <div key={id} className={id === 'activity' ? 'lg:col-span-2' : ''}>
                {containers[id as keyof typeof containers]}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
