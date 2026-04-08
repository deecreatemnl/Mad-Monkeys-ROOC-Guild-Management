import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles, UserPlus, UserMinus, Calendar, ChevronRight, History, Settings, Play, RotateCcw, Check, X, ArrowLeft, Clock, Trash2, RefreshCw, ShieldAlert, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchAPI } from '../lib/api';
import RaffleAnimation from '../components/RaffleAnimation';
import { cn } from '../lib/utils';

export default function RafflePage() {
  const [raffle, setRaffle] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [isAnimationRunning, setIsAnimationRunning] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [lastWinners, setLastWinners] = useState<any[]>([]);
  const [testEntries, setTestEntries] = useState<any[]>([]);
  const [testWinners, setTestWinners] = useState<any[]>([]);
  const [isTest, setIsTest] = useState(false);
  const [revealedWinners, setRevealedWinners] = useState<any[]>([]);
  const [tick, setTick] = useState(0);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerSettings, setHeaderSettings] = useState({
    title: 'GUILD <span class="text-orange-500">RAFFLE</span>',
    description: 'Join the weekly raffle for a chance to bid on puppet card fragments. Two winners are selected every week! A total of 20 puppet card fragments which means it\'s 10 fragments to buy for each player weekly!',
    clockText: 'Raffle draw starts at 10pm Sunday Philippine Standard Time',
    sparkleText: 'Weekly Card Bidding Raffle'
  });

  const isRaffleLocked = () => {
    const now = new Date();
    const day = now.getUTCDay(); // 0 is Sunday
    const hour = now.getUTCHours();
    
    // Sunday 10pm PHT = Sunday 14:00 UTC
    // Monday 6am PHT = Sunday 22:00 UTC
    // Window: Sunday 14:00 UTC to Sunday 22:00 UTC
    if (day === 0 && hour >= 14 && hour < 22) {
      return true;
    }
    return false;
  };

  const [isRestrictedModalOpen, setIsRestrictedModalOpen] = useState(false);
  const [restrictedMemberIds, setRestrictedMemberIds] = useState<string[]>([]);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [overrideWinnerId, setOverrideWinnerId] = useState<string | null>(null);
  const [overrideMemberId, setOverrideMemberId] = useState('');
  const [tempSettings, setTempSettings] = useState({ week: 1, month: 1, year: 2026 });

  const [raffleWinnersCount, setRaffleWinnersCount] = useState(2);

  const loadData = async () => {
    try {
      const [raffleData, membersData, settingsData] = await Promise.all([
        fetchAPI('/api/raffle'),
        fetchAPI('/api/members'),
        fetchAPI('/api/settings')
      ]);
      setRaffle(raffleData);
      setMembers(membersData);
      // Store settings in a way that RafflePage can use them
      (window as any).raffleSettings = settingsData;
      if (settingsData && settingsData.raffleWinners) {
        setRaffleWinnersCount(settingsData.raffleWinners);
      }
      
      setRestrictedMemberIds(raffleData.settings.restrictedMemberIds || []);
      
      if (raffleData.settings.header) {
        setHeaderSettings(prev => ({ ...prev, ...raffleData.settings.header }));
      }

      setTempSettings({
        week: raffleData.settings.currentWeek,
        month: raffleData.settings.currentMonth,
        year: raffleData.settings.currentYear
      });
      
      // Check if current user is admin
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setIsAdmin(user.role === 'admin' || user.role === 'superadmin');
        setIsSuperAdmin(user.role === 'superadmin');
      }
    } catch (err) {
      console.error('Failed to load raffle data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHeader = async () => {
    try {
      await fetchAPI('/api/raffle/settings', {
        method: 'POST',
        body: JSON.stringify({ header: headerSettings })
      });
      setIsEditingHeader(false);
      await loadData();
    } catch (err: any) {
      alert('Failed to save header settings: ' + err.message);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh every minute to update lock status
    const interval = setInterval(() => {
      setTick(t => t + 1);
      loadData();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    if (isRaffleLocked()) {
      alert('The raffle is currently locked for drawing. Please try again on Monday morning.');
      return;
    }
    
    setJoining(true);
    try {
      await fetchAPI('/api/raffle/join', {
        method: 'POST',
        body: JSON.stringify({ memberId: selectedMemberId })
      });
      await loadData();
      setSelectedMemberId('');
      alert('Successfully joined the raffle!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleDraw = async () => {
    console.log('[RafflePage] Drawing winners...');
    if (!confirm('Are you sure you want to draw winners for this week?')) return;
    
    setDrawing(true);
    try {
      const result = await fetchAPI('/api/raffle/draw', { 
        method: 'POST'
      });
      console.log('[RafflePage] Draw result:', result);
      setLastWinners(result.winners);
      setRevealedWinners([]);
      setIsTest(false);
      setShowAnimation(true);
      setIsAnimationRunning(true);
      await loadData();
    } catch (err: any) {
      console.error('[RafflePage] Draw error:', err);
      alert(err.message);
    } finally {
      setDrawing(false);
    }
  };

  const handleClearEntries = async () => {
    console.log('[RafflePage] Clearing all entries...');
    if (!confirm('Are you sure you want to clear ALL entries? This cannot be undone.')) return;
    try {
      await fetchAPI('/api/raffle/clear-entries', { method: 'POST' });
      await loadData();
      alert('All entries cleared successfully.');
    } catch (err: any) {
      console.error('[RafflePage] Clear entries error:', err);
      alert(err.message);
    }
  };

  const handleReset = async () => {
    if (!raffle || !raffle.settings) {
      alert('Raffle data not loaded yet.');
      return;
    }
    console.log('[RafflePage] Resetting raffle...');
    const week = prompt('Enter week number (1-5):', raffle.settings.currentWeek.toString());
    if (!week) return;
    const month = prompt('Enter month number (1-12):', raffle.settings.currentMonth.toString());
    if (!month) return;
    const year = prompt('Enter year:', raffle.settings.currentYear.toString());
    if (!year) return;
    
    try {
      const result = await fetchAPI('/api/raffle/reset', {
        method: 'POST',
        body: JSON.stringify({ 
          nextWeek: parseInt(week),
          nextMonth: parseInt(month),
          nextYear: parseInt(year)
        })
      });
      console.log('[RafflePage] Reset result:', result);
      await loadData();
      setShowAnimation(false);
      setLastWinners([]);
      alert('Raffle reset successfully.');
    } catch (err: any) {
      console.error('[RafflePage] Reset error:', err);
      alert(err.message);
    }
  };

  const handleTestAnimation = () => {
    // Generate 10 fake entries
    const fakeEntries = [
      { id: 't1', ign: 'DuckMaster' },
      { id: 't2', ign: 'QuackQuack' },
      { id: 't3', ign: 'PekingDuck' },
      { id: 't4', ign: 'Donald' },
      { id: 't5', ign: 'Daffy' },
      { id: 't6', ign: 'Howard' },
      { id: 't7', ign: 'Darkwing' },
      { id: 't8', ign: 'Scrooge' },
      { id: 't9', ign: 'Launchpad' },
      { id: 't10', ign: 'Webby' },
    ];
    
    // Select random winners based on setting
    const winnersToDraw = raffleWinnersCount || 2;
    console.log(`[RafflePage] Drawing ${winnersToDraw} test winners (settings: ${raffleWinnersCount})`);
    const shuffled = [...fakeEntries].sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, winnersToDraw).map((w, idx) => ({
      ...w,
      round: idx + 1,
      prize: raffle.settings.prizes?.[idx] || 'TBD'
    }));
    
    setTestEntries(fakeEntries);
    setTestWinners(winners);
    setRevealedWinners([]);
    setIsTest(true);
    setShowAnimation(true);
    setIsAnimationRunning(true);
  };

  const handleReroll = async (winnerId: string) => {
    if (!confirm('Are you sure you want to reroll this winner?')) return;
    try {
      const result = await fetchAPI('/api/raffle/reroll', {
        method: 'POST',
        body: JSON.stringify({ winnerId })
      });
      alert('Winner rerolled successfully!');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideWinnerId || !overrideMemberId) return;
    try {
      await fetchAPI('/api/raffle/override', {
        method: 'POST',
        body: JSON.stringify({ winnerId: overrideWinnerId, newMemberId: overrideMemberId })
      });
      alert('Winner overridden successfully!');
      setIsOverrideModalOpen(false);
      setOverrideWinnerId(null);
      setOverrideMemberId('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateRestrictions = async () => {
    try {
      await fetchAPI('/api/raffle/settings', {
        method: 'POST',
        body: JSON.stringify({ restrictedMemberIds })
      });
      alert('Restrictions updated successfully!');
      setIsRestrictedModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateRaffleSettings = async () => {
    try {
      await fetchAPI('/api/raffle/settings', {
        method: 'POST',
        body: JSON.stringify({
          currentWeek: Number(tempSettings.week),
          currentMonth: Number(tempSettings.month),
          currentYear: Number(tempSettings.year),
          prizes: raffle.settings.prizes || []
        })
      });
      setIsSettingsModalOpen(false);
      await loadData();
      alert('Raffle settings updated and synced!');
    } catch (err: any) {
      console.error('Failed to update raffle settings:', err);
      alert('Failed to update raffle settings: ' + err.message);
    }
  };

  const toggleRestriction = (memberId: string) => {
    setRestrictedMemberIds(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId) 
        : [...prev, memberId]
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const currentMonthWinners = (raffle.winners || []).filter((w: any) => 
    w.month === raffle.settings.currentMonth && 
    w.year === raffle.settings.currentYear
  ).filter((w: any) => {
    // If animation is running, don't show the latest winners yet
    if (isAnimationRunning && !isTest && lastWinners.some(lw => lw.id === w.memberId)) {
      return revealedWinners.some(rw => rw.id === w.memberId);
    }
    return true;
  });

  // For test animation, we also want to show revealed winners in the sidebar if possible
  // But the sidebar is tied to raffle.winners. Let's add a separate section or mock it.
  // Actually, let's just focus on the real draw for now as per user request.

  const winnersByWeek = currentMonthWinners.reduce((acc: any, winner: any) => {
    if (!acc[winner.week]) acc[winner.week] = [];
    acc[winner.week].push(winner);
    return acc;
  }, {});

  const currentWeekEntries = (raffle.entries || []).filter((e: any) => {
    const isCorrectWeek = e.week === raffle.settings.currentWeek &&
                         e.month === raffle.settings.currentMonth &&
                         e.year === raffle.settings.currentYear;
    // Ensure they haven't won this month already (in case they joined before winning)
    const hasAlreadyWonThisMonth = (raffle.winners || []).some(w => 
      w.memberId === e.memberId && 
      Number(w.month) === Number(raffle.settings.currentMonth) && 
      Number(w.year) === Number(raffle.settings.currentYear)
    );
    return isCorrectWeek && !hasAlreadyWonThisMonth;
  });

  const currentWeekWinners = (raffle.winners || []).filter((w: any) => 
    Number(w.week) === Number(raffle.settings.currentWeek) &&
    Number(w.month) === Number(raffle.settings.currentMonth) &&
    Number(w.year) === Number(raffle.settings.currentYear)
  );

  const handleAdvance = async () => {
    if (isAdvancing) return;
    if (!confirm('Advance to the next week and reopen for entries? This will clear current entries.')) return;
    
    setIsAdvancing(true);
    try {
      console.log('[RafflePage] Advancing raffle...');
      const result = await fetchAPI('/api/raffle/advance', { method: 'POST' });
      console.log('[RafflePage] Advance result:', result);
      await loadData();
      alert('Raffle advanced to the next week and reopened!');
    } catch (err: any) {
      console.error('[RafflePage] Advance error:', err);
      alert('Failed to advance raffle: ' + err.message);
    } finally {
      setIsAdvancing(false);
    }
  };

  const availableMembers = members.filter(m => {
    // Active, busy, or on-leave members can join the raffle
    const status = m.status || 'active';
    if (status === 'left') return false;
    
    // Not a winner this month
    const isWinnerThisMonth = currentMonthWinners.some(w => w.memberId === m.id);
    // Not already entered this week
    const isEnteredThisWeek = currentWeekEntries.some(e => e.memberId === m.id);
    return !isWinnerThisMonth && !isEnteredThisWeek;
  }).sort((a, b) => a.ign.localeCompare(b.ign));

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(raffle.settings.currentYear, raffle.settings.currentMonth - 1));
  const locked = isRaffleLocked();

  const getActualCurrentWeek = () => {
    const now = new Date();
    // PHT is UTC+8
    const phtDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
    const day = phtDate.getDay(); // 0 is Sunday
    const hours = phtDate.getHours();
    
    // The "Current" week for the winners list is the week of the MOST RECENT draw.
    // Draws happen Sunday 10pm.
    const lastDrawSunday = new Date(phtDate);
    if (day === 0 && hours < 22) {
      // It's Sunday before 10pm, the last draw was LAST Sunday.
      lastDrawSunday.setDate(phtDate.getDate() - 7);
    } else {
      // It's Sunday after 10pm or any other day, the last draw was this past Sunday.
      lastDrawSunday.setDate(phtDate.getDate() - day);
    }
    
    const month = lastDrawSunday.getMonth();
    const year = lastDrawSunday.getFullYear();
    
    // Find the first Sunday of that month
    const firstOfMonth = new Date(year, month, 1);
    let firstSunday = new Date(firstOfMonth);
    while (firstSunday.getDay() !== 0) {
      firstSunday.setDate(firstSunday.getDate() + 1);
    }
    
    const diff = lastDrawSunday.getDate() - firstSunday.getDate();
    if (diff < 0) return 0; // Draw was in previous month
    return Math.floor(diff / 7) + 1;
  };

  const actualCurrentWeek = getActualCurrentWeek();
  const now = new Date();
  const actualMonth = now.getMonth() + 1;
  const actualYear = now.getFullYear();

  const getBiddingDates = (week: number, month: number, year: number) => {
    // Find all Sundays in the month
    const sundays: Date[] = [];
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === 0) {
        sundays.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }

    const drawSunday = sundays[week - 1];
    if (!drawSunday) return null;

    // Bidding days are the following Tue, Thu, Sat, Sun
    const biddingDays = [2, 4, 6, 7].map(offset => {
      const d = new Date(drawSunday);
      d.setDate(d.getDate() + offset);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return `Tue, Thu, Sat, Sun (${biddingDays.join(', ')})`;
  };

  const handleRemoveEntry = async (entryId: string) => {
    console.log('[RafflePage] Removing entry:', entryId);
    if (!confirm('Are you sure you want to remove this entry?')) return;
    try {
      const result = await fetchAPI('/api/raffle/remove-entry', {
        method: 'POST',
        body: JSON.stringify({ entryId })
      });
      console.log('[RafflePage] Remove result:', result);
      await loadData();
    } catch (err: any) {
      console.error('[RafflePage] Remove error:', err);
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      {/* Navigation Bar */}
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-500" />
            <span className="font-black italic tracking-tighter">GUILD RAFFLE</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors text-zinc-400 hover:text-white"
                title="Raffle Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <div className="w-10" /> {/* Spacer */}
          </div>
        </div>
      </div>

      {/* Header Section */}
      <div className="relative h-96 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/raffle/1920/1080')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/50 to-zinc-950" />
        
        <div className="relative z-10 text-center px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold uppercase tracking-widest mb-4"
          >
            <Sparkles className="w-3 h-3" />
            {headerSettings.sparkleText}
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tighter italic mb-4"
            dangerouslySetInnerHTML={{ __html: headerSettings.title }}
          />
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-300 text-lg font-medium leading-relaxed"
          >
            {headerSettings.description}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex items-center justify-center gap-2 text-orange-500 font-bold text-base bg-orange-500/10 py-3 px-6 rounded-2xl border border-orange-500/20 shadow-lg shadow-orange-500/10"
          >
            <Clock className="w-5 h-5" />
            {headerSettings.clockText}
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-20 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Winners History */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Winners for {monthName} {raffle.settings.currentYear}
              </h2>
              
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map(week => {
                  const biddingDates = getBiddingDates(week, raffle.settings.currentMonth, raffle.settings.currentYear);
                  if (week > 4 && !biddingDates) return null;

                  return (
                    <div key={week} className="space-y-2">
                      <div className="flex flex-col gap-1 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        <div className="flex items-center justify-between">
                          <span>Week {week}</span>
                          <div className="flex items-center gap-1">
                            {raffle.settings.currentWeek === week && (
                              <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full text-[9px]">Upcoming</span>
                            )}
                            {actualCurrentWeek === week && actualMonth === raffle.settings.currentMonth && actualYear === raffle.settings.currentYear && (
                              <span className="text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full text-[9px]">Current</span>
                            )}
                          </div>
                        </div>
                        {biddingDates && (
                          <div className="text-[10px] text-zinc-600 normal-case font-medium">
                            Bidding: {biddingDates}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {winnersByWeek[week]?.length > 0 ? (
                          winnersByWeek[week].map((winner: any) => (
                            <div key={winner.id} className="flex items-center gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50">
                              <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-yellow-500" />
                              </div>
                              <div className="flex flex-col flex-1">
                                <span className="font-bold text-sm">{winner.ign}</span>
                                {(() => {
                                  // Hardcoded fallback for specific users as requested
                                  if (winner.ign.toLowerCase() === 'ayachii' && (!winner.prize || winner.prize === 'TBD')) {
                                    return <span className="text-[10px] text-orange-500/70 font-bold uppercase">Card Bidding Slot 1</span>;
                                  }
                                  if (winner.ign.toLowerCase() === 'xyleia' && (!winner.prize || winner.prize === 'TBD')) {
                                    return <span className="text-[10px] text-orange-500/70 font-bold uppercase">Card Bidding Slot 2</span>;
                                  }

                                  const prize = winner.prize || (raffle.settings.prizes && raffle.settings.prizes[winner.round - 1]);
                                  if (prize && prize !== 'TBD') {
                                    return <span className="text-[10px] text-orange-500/70 font-bold uppercase">{prize}</span>;
                                  }
                                  return <span className="text-[10px] text-zinc-600 font-bold uppercase italic">TBD</span>;
                                })()}
                              </div>
                              {isAdmin && raffle.settings.currentWeek === week && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleReroll(winner.id)}
                                    className="p-1.5 text-zinc-500 hover:text-orange-500 transition-colors"
                                    title="Reroll Winner"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  {isSuperAdmin && (
                                    <button
                                      onClick={() => {
                                        setOverrideWinnerId(winner.id);
                                        setIsOverrideModalOpen(true);
                                      }}
                                      className="p-1.5 text-zinc-500 hover:text-blue-500 transition-colors"
                                      title="Superadmin Override"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-zinc-600 text-sm italic py-2">No winners yet</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center Column: Join & Animation */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Animation Section */}
            {showAnimation && (isTest ? testWinners.length > 0 : lastWinners.length > 0) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <RaffleAnimation 
                  entries={isTest ? testEntries : currentWeekEntries} 
                  winners={isTest ? testWinners : lastWinners} 
                  prizes={raffle.settings.prizes || []}
                  onWinnerRevealed={(winner) => {
                    setRevealedWinners(prev => [...prev, winner]);
                  }}
                  onComplete={() => setIsAnimationRunning(false)}
                  onClose={() => {
                    setShowAnimation(false);
                    setIsTest(false);
                    setIsAnimationRunning(false);
                  }}
                />
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setShowAnimation(false);
                      setIsTest(false);
                      setIsAnimationRunning(false);
                    }}
                    className="text-sm text-zinc-500 hover:text-zinc-300 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Close Animation
                  </button>
                </div>
              </motion.div>
            )}

            {/* Join Section */}
            {!showAnimation && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Sparkles className="w-32 h-32 text-orange-500" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-black italic tracking-tighter">JOIN THE <span className="text-orange-500">RAFFLE</span></h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-orange-500/10 text-orange-500 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider border border-orange-500/20">Upcoming</span>
                        <p className="text-zinc-500 text-sm">Week {raffle.settings.currentWeek} • {monthName} {raffle.settings.currentYear}</p>
                      </div>
                    </div>
                    {locked ? (
                      <div className="flex items-center gap-2 text-orange-500 text-sm font-bold bg-orange-500/10 px-4 py-1.5 rounded-full border border-orange-500/20">
                        <Clock className="w-4 h-4" />
                        LOCKED FOR DRAW
                      </div>
                    ) : raffle.settings.isOpen ? (
                      <div className="flex items-center gap-2 text-green-500 text-sm font-bold bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/20">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        RAFFLE OPEN
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-zinc-500 text-sm font-bold bg-zinc-500/10 px-4 py-1.5 rounded-full border border-zinc-500/20">
                        <div className="w-2 h-2 rounded-full bg-zinc-500" />
                        RAFFLE CLOSED
                      </div>
                    )}
                  </div>

                  {raffle.settings.isOpen && !locked ? (
                    <form onSubmit={handleJoin} className="space-y-4">
                      <div className="relative group">
                        <select
                          required
                          value={selectedMemberId}
                          onChange={(e) => setSelectedMemberId(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl py-4 px-6 text-white appearance-none focus:ring-2 focus:ring-orange-500/50 outline-none transition-all group-hover:border-zinc-600"
                        >
                          <option value="">Select your IGN</option>
                          {availableMembers.map(member => (
                            <option key={member.id} value={member.id}>{member.ign}</option>
                          ))}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                          <ChevronRight className="w-5 h-5 rotate-90" />
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={joining || !selectedMemberId || locked}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white font-black italic tracking-tighter py-4 px-8 rounded-2xl text-xl transition-all active:scale-95 shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3"
                      >
                        {joining ? (
                          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-6 h-6" />
                            JOIN RAFFLE
                          </>
                        )}
                      </button>
                      <p className="text-center text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        Winners are excluded from the raffle until the end of the month
                      </p>
                    </form>
                  ) : locked ? (
                    <div className="text-center py-12 bg-orange-500/5 rounded-2xl border border-dashed border-orange-500/20">
                      <Clock className="w-12 h-12 text-orange-500/50 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-orange-500">Raffle is currently locked</h3>
                      <p className="text-zinc-500 text-sm mt-1">The draw is in progress. Entries will reopen Monday morning 6am PHT.</p>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-zinc-800/30 rounded-2xl border border-dashed border-zinc-700">
                      <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-zinc-400">Raffle has ended for this week</h3>
                      <p className="text-zinc-500 text-sm mt-1 mb-6">Wait for the next week's raffle to open!</p>
                      
                      {isAdmin && currentWeekWinners.length > 0 && (
                        <button
                          onClick={handleAdvance}
                          disabled={isAdvancing}
                          className={cn(
                            "bg-orange-500 hover:bg-orange-600 text-white font-black italic tracking-tighter py-3 px-8 rounded-xl text-sm transition-all active:scale-95 shadow-xl shadow-orange-500/20 flex items-center gap-2 mx-auto",
                            isAdvancing && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {isAdvancing ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              OPENING...
                            </>
                          ) : (
                            `OPEN WEEK ${raffle.settings.currentWeek >= 5 ? 1 : raffle.settings.currentWeek + 1}`
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prize Preview Section */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-orange-500" />
                Upcoming Week Prizes
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: raffleWinnersCount }).map((_, idx) => {
                  const prize = raffle.settings.prizes?.[idx];
                  return (
                    <div key={idx} className="bg-zinc-800/30 border border-zinc-700/30 p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 font-black italic">
                        R{idx + 1}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Round {idx + 1} Prize</p>
                        <p className={cn("text-sm font-bold", prize ? "text-white" : "text-zinc-600 italic")}>
                          {prize || 'TBD'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Entries List */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-orange-500" />
                  Current Entries ({currentWeekEntries.length})
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {currentWeekEntries.map((entry: any) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-zinc-800/50 border border-zinc-700/50 p-3 rounded-xl text-center text-sm font-medium text-zinc-300 relative group"
                  >
                    {entry.ign}
                    {isAdmin && (
                      <button
                        onClick={() => handleRemoveEntry(entry.id)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </motion.div>
                ))}
                {currentWeekEntries.length === 0 && (
                  <div className="col-span-full py-8 text-center text-zinc-600 italic text-sm">
                    No entries yet for this week.
                  </div>
                )}
              </div>
            </div>

            {/* Admin Controls removed as per user request */}
          </div>
        </div>
      </div>
      {/* Header Edit Modal */}
      <AnimatePresence>
        {isEditingHeader && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingHeader(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Edit Raffle Header</h2>
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest mt-1">Customize the top section text</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingHeader(false)}
                  className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Sparkle Badge Text</label>
                  <input
                    type="text"
                    value={headerSettings.sparkleText}
                    onChange={(e) => setHeaderSettings({ ...headerSettings, sparkleText: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                    placeholder="e.g. Weekly Card Bidding Raffle"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Main Title (HTML allowed)</label>
                  <input
                    type="text"
                    value={headerSettings.title}
                    onChange={(e) => setHeaderSettings({ ...headerSettings, title: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                    placeholder='e.g. GUILD <span class="text-orange-500">RAFFLE</span>'
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Description Text</label>
                  <textarea
                    value={headerSettings.description}
                    onChange={(e) => setHeaderSettings({ ...headerSettings, description: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors h-32 resize-none"
                    placeholder="Describe the raffle..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Clock/Schedule Text</label>
                  <input
                    type="text"
                    value={headerSettings.clockText}
                    onChange={(e) => setHeaderSettings({ ...headerSettings, clockText: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                    placeholder="e.g. Raffle draw starts at 10pm Sunday..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setIsEditingHeader(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveHeader}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Monthly Restrictions Modal */}
      <AnimatePresence>
        {isRestrictedModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRestrictedModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Monthly Restrictions</h2>
                  <p className="text-zinc-500 text-sm">Select members to disallow from entering the raffle this month</p>
                </div>
                <button onClick={() => setIsRestrictedModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {members.sort((a, b) => a.ign.localeCompare(b.ign)).map(member => (
                    <button
                      key={member.id}
                      onClick={() => toggleRestriction(member.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                        restrictedMemberIds.includes(member.id)
                          ? "bg-red-500/10 border-red-500/50 text-red-500"
                          : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                      )}
                    >
                      <span className="font-bold text-sm">{member.ign}</span>
                      {restrictedMemberIds.includes(member.id) && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3">
                <button
                  onClick={() => setIsRestrictedModalOpen(false)}
                  className="px-6 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRestrictions}
                  className="px-6 py-2 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-lg shadow-orange-500/20"
                >
                  Save Restrictions
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Superadmin Override Modal */}
      <AnimatePresence>
        {isOverrideModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOverrideModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">Superadmin Override</h2>
                <button onClick={() => setIsOverrideModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleOverride} className="p-6 space-y-4">
                <p className="text-zinc-400 text-sm">Select a member who has an entry for this week to override the current winner.</p>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select New Winner</label>
                  <select
                    required
                    value={overrideMemberId}
                    onChange={(e) => setOverrideMemberId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Select Member</option>
                    {currentWeekEntries.map((entry: any) => (
                      <option key={entry.memberId} value={entry.memberId}>{entry.ign}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOverrideModalOpen(false)}
                    className="px-6 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl text-sm font-bold bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-lg shadow-blue-500/20"
                  >
                    Confirm Override
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Raffle Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">Raffle Settings</h2>
                <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Upcoming Week Settings</h3>
                  <p className="text-zinc-500 text-[10px] leading-tight">These settings determine which week, month, and year new entries will be assigned to.</p>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Week</label>
                      <select
                        value={tempSettings.week}
                        onChange={(e) => setTempSettings({ ...tempSettings, week: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>Week {w}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Month</label>
                      <select
                        value={tempSettings.month}
                        onChange={(e) => setTempSettings({ ...tempSettings, month: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{new Date(2026, m - 1).toLocaleString('default', { month: 'short' })}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Year</label>
                      <select
                        value={tempSettings.year}
                        onChange={(e) => setTempSettings({ ...tempSettings, year: Number(e.target.value) })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Prizes (Round 1 to {raffleWinnersCount})</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: raffleWinnersCount }).map((_, idx) => (
                        <input
                          key={idx}
                          type="text"
                          placeholder={`Round ${idx + 1} Prize`}
                          value={raffle.settings.prizes?.[idx] || ''}
                          onChange={(e) => {
                            const newPrizes = [...(raffle.settings.prizes || [])];
                            // Ensure the array is long enough
                            while (newPrizes.length < raffleWinnersCount) newPrizes.push('');
                            newPrizes[idx] = e.target.value;
                            setRaffle({ ...raffle, settings: { ...raffle.settings, prizes: newPrizes } });
                          }}
                          className="bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-orange-500/50"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateRaffleSettings}
                    className="w-full px-6 py-2.5 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-lg shadow-orange-500/20"
                  >
                    Sync Upcoming Week & Prizes
                  </button>
                </div>

                <div className="h-px bg-zinc-800" />

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Raffle Management</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleDraw}
                      disabled={drawing || currentWeekEntries.length < 2}
                      className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      Draw Winners
                    </button>
                    <button
                      onClick={async () => {
                        const isOpen = !raffle.settings.isOpen;
                        await fetchAPI('/api/raffle/settings', {
                          method: 'POST',
                          body: JSON.stringify({ isOpen })
                        });
                        await loadData();
                      }}
                      className={cn(
                        "flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl transition-all",
                        raffle.settings.isOpen 
                          ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20" 
                          : "bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20"
                      )}
                    >
                      {raffle.settings.isOpen ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      {raffle.settings.isOpen ? 'Close Raffle' : 'Open Raffle'}
                    </button>
                    <button
                      onClick={() => { setIsSettingsModalOpen(false); setIsEditingHeader(true); }}
                      className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-3 rounded-xl border border-zinc-700 transition-all"
                    >
                      <Edit2 className="w-4 h-4 text-blue-500" />
                      Edit Header
                    </button>
                    <button
                      onClick={() => { setIsSettingsModalOpen(false); setIsRestrictedModalOpen(true); }}
                      className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-3 rounded-xl border border-zinc-700 transition-all"
                    >
                      <UserMinus className="w-4 h-4 text-red-500" />
                      Restrictions
                    </button>
                    <button
                      onClick={() => { setIsSettingsModalOpen(false); handleTestAnimation(); }}
                      className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-3 rounded-xl border border-zinc-700 transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-orange-500" />
                      Test Animation
                    </button>
                    <button
                      onClick={handleClearEntries}
                      className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 text-xs font-bold py-3 rounded-xl border border-zinc-700 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear Entries
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="w-full px-6 py-2 rounded-xl text-sm font-bold text-zinc-500 hover:text-white transition-colors"
                  >
                    Close Settings
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
