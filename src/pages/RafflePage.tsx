import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles, UserPlus, Calendar, ChevronRight, History, Settings, Play, RotateCcw, Check, X, ArrowLeft, Clock, Trash2 } from 'lucide-react';
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastWinners, setLastWinners] = useState<any[]>([]);
  const [tick, setTick] = useState(0);

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

  const loadData = async () => {
    try {
      const [raffleData, membersData] = await Promise.all([
        fetchAPI('/api/raffle'),
        fetchAPI('/api/members')
      ]);
      setRaffle(raffleData);
      setMembers(membersData);
      
      // Check if current user is admin
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setIsAdmin(user.role === 'admin' || user.role === 'superadmin');
      }
    } catch (err) {
      console.error('Failed to load raffle data:', err);
    } finally {
      setLoading(false);
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
      const result = await fetchAPI('/api/raffle/draw', { method: 'POST' });
      console.log('[RafflePage] Draw result:', result);
      setLastWinners(result.winners);
      setShowAnimation(true);
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

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const currentMonthWinners = (raffle.winners || []).filter((w: any) => 
    w.month === raffle.settings.currentMonth && 
    w.year === raffle.settings.currentYear
  );

  const winnersByWeek = currentMonthWinners.reduce((acc: any, winner: any) => {
    if (!acc[winner.week]) acc[winner.week] = [];
    acc[winner.week].push(winner);
    return acc;
  }, {});

  const currentWeekEntries = (raffle.entries || []).filter((e: any) => 
    e.week === raffle.settings.currentWeek &&
    e.month === raffle.settings.currentMonth &&
    e.year === raffle.settings.currentYear
  );

  const availableMembers = members.filter(m => {
    // Not a winner this month
    const isWinnerThisMonth = currentMonthWinners.some(w => w.memberId === m.id);
    // Not already entered this week
    const isEnteredThisWeek = currentWeekEntries.some(e => e.memberId === m.id);
    return !isWinnerThisMonth && !isEnteredThisWeek;
  }).sort((a, b) => a.ign.localeCompare(b.ign));

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(raffle.settings.currentYear, raffle.settings.currentMonth - 1));
  const locked = isRaffleLocked();

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
          <div className="w-24" /> {/* Spacer */}
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
            Weekly Card Bidding Raffle
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tighter italic mb-4"
          >
            GUILD <span className="text-orange-500">RAFFLE</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-300 text-lg font-medium leading-relaxed"
          >
            Join the weekly raffle for a chance to bid on puppet card fragments. Two winners are selected every week! A total of 20 puppet card fragments which means it's 10 fragments to buy for each player weekly!
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex items-center justify-center gap-2 text-orange-500 font-bold text-base bg-orange-500/10 py-3 px-6 rounded-2xl border border-orange-500/20 shadow-lg shadow-orange-500/10"
          >
            <Clock className="w-5 h-5" />
            Raffle draw starts at 10pm Sunday Philippine Standard Time
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
                          {raffle.settings.currentWeek === week && (
                            <span className="text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">Current</span>
                          )}
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
                              <span className="font-bold text-sm">{winner.ign}</span>
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
            {showAnimation && lastWinners.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <RaffleAnimation 
                  entries={currentWeekEntries} 
                  winners={lastWinners} 
                />
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowAnimation(false)}
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
                      <p className="text-zinc-500 text-sm">Week {raffle.settings.currentWeek} • {monthName} {raffle.settings.currentYear}</p>
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
                      <p className="text-zinc-500 text-sm mt-1">Wait for the next week's raffle to open!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current Entries List */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-orange-500" />
                  Current Entries ({currentWeekEntries.length})
                </h2>
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleClearEntries}
                      className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All
                    </button>
                    <button
                      onClick={handleDraw}
                      disabled={drawing || currentWeekEntries.length < 2}
                      className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      Draw Winners
                    </button>
                  </div>
                )}
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
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
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

            {/* Admin Controls */}
            {isAdmin && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-6 text-orange-500">
                  <Settings className="w-5 h-5" />
                  Admin Controls
                </h2>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2 rounded-xl border border-zinc-700 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset / Set Week
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
                      "flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all",
                      raffle.settings.isOpen 
                        ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20" 
                        : "bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20"
                    )}
                  >
                    {raffle.settings.isOpen ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    {raffle.settings.isOpen ? 'Close Raffle' : 'Open Raffle'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
