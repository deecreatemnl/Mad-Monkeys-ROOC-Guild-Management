import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles, Star } from 'lucide-react';

interface RaffleAnimationProps {
  entries: any[];
  winners: any[];
  onWinnerRevealed?: (winner: any) => void;
  onComplete?: () => void;
  onClose?: () => void;
}

export default function RaffleAnimation({ entries, winners, onWinnerRevealed, onComplete, onClose }: RaffleAnimationProps) {
  const [round, setRound] = useState(1);
  const [isSpinning, setIsSpinning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showWinners, setShowWinners] = useState(false);
  const [roundWinner, setRoundWinner] = useState<any>(null);
  const [displayEntries, setDisplayEntries] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize for the current round
  const initRound = (currentRound: number) => {
    const targetWinner = winners[currentRound - 1];
    
    // Create a long list for the "slot machine" effect
    // We repeat the entries many times to ensure a long scroll
    const repeatedEntries = [];
    const pool = entries.filter(e => currentRound === 1 || e.id !== winners[0].id);
    
    // Shuffle the pool for variety
    const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < 10; i++) {
      repeatedEntries.push(...shuffledPool);
    }
    
    // Ensure the winner is at a specific position near the end
    // Let's say we want to land on index 45
    const winnerIndex = 45;
    if (targetWinner) {
      repeatedEntries[winnerIndex] = targetWinner;
    }
    
    setDisplayEntries(repeatedEntries);
    setRoundWinner(null);
    setIsSpinning(false);
    
    // Start countdown
    setCountdown(3);
  };

  // Countdown logic
  useEffect(() => {
    if (countdown !== null) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setCountdown(null);
          startSpin();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [countdown]);

  useEffect(() => {
    if (entries.length > 0 && winners.length > 0) {
      initRound(1);
    }
  }, [entries, winners]);

  const startSpin = () => {
    setIsSpinning(true);
    
    // After some time, reveal the winner
    setTimeout(() => {
      const winner = winners[round - 1];
      setRoundWinner(winner);
      if (onWinnerRevealed) onWinnerRevealed(winner);
      
      setTimeout(() => {
        setIsSpinning(false);
        
        setTimeout(() => {
          if (round === 1 && winners.length > 1) {
            setRound(2);
            initRound(2);
          } else {
            setShowWinners(true);
            if (onComplete) onComplete();
          }
        }, 3000);
      }, 1000);
    }, 5000); // 5 seconds spin
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto h-[500px] bg-zinc-900 rounded-[2rem] border-4 border-zinc-800 overflow-hidden shadow-2xl">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/20 via-transparent to-transparent" />
        
        {/* Animated Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-orange-500/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!showWinners ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Round Indicator */}
            <div className="absolute top-8 z-50">
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-zinc-800/80 backdrop-blur-xl px-6 py-2 rounded-full border border-zinc-700 text-xs font-black text-white uppercase tracking-[0.3em]"
              >
                ROUND {round} of {winners.length}
              </motion.div>
            </div>

            {/* Slot Machine Container */}
            <div className="relative w-full max-w-md h-48 bg-zinc-950 rounded-3xl border-2 border-zinc-800 shadow-inner overflow-hidden">
              {/* Selection Overlay */}
              <div className="absolute inset-0 z-20 pointer-events-none">
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-zinc-950 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent" />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-16 border-y-2 border-orange-500/30 bg-orange-500/5" />
              </div>

              {/* Scrolling List */}
              <motion.div
                className="flex flex-col items-center"
                animate={isSpinning ? {
                  y: [0, -2000],
                } : roundWinner ? {
                  y: -2000, // Stay on winner
                } : {
                  y: 0
                }}
                transition={isSpinning ? {
                  duration: 5,
                  ease: [0.45, 0.05, 0.55, 0.95],
                } : {
                  duration: 0.5
                }}
              >
                {displayEntries.map((entry, i) => (
                  <div 
                    key={`${entry.id}-${i}`}
                    className="h-16 flex items-center justify-center w-full"
                  >
                    <span className={`text-xl font-bold tracking-tight ${roundWinner?.id === entry.id ? 'text-orange-500 scale-125' : 'text-zinc-600'}`}>
                      {entry.ign}
                    </span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Countdown Overlay */}
            <AnimatePresence>
              {countdown !== null && (
                <motion.div
                  key="countdown"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 2, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center z-[100] pointer-events-none"
                >
                  <div className="text-9xl font-black text-white drop-shadow-2xl italic">
                    {countdown === 0 ? "DRAW!" : countdown}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Winner Reveal Overlay */}
            <AnimatePresence>
              {roundWinner && !isSpinning && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-[110] bg-zinc-950/40 backdrop-blur-sm"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [-2, 2, -2]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="bg-gradient-to-br from-orange-500 to-amber-600 p-1 rounded-[2.5rem] shadow-[0_0_50px_rgba(249,115,22,0.4)]"
                  >
                    <div className="bg-zinc-900 px-12 py-8 rounded-[2.2rem] flex flex-col items-center gap-4">
                      <Trophy className="w-12 h-12 text-orange-500 animate-bounce" />
                      <div className="text-center">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Winner Round {round}</p>
                        <h3 className="text-4xl font-black italic tracking-tighter text-white">{roundWinner.ign}</h3>
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-orange-500 fill-orange-500" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                  
                  {/* Confetti-like particles */}
                  {[...Array(30)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: 0, y: 0, scale: 0 }}
                      animate={{ 
                        x: (Math.random() - 0.5) * 600,
                        y: (Math.random() - 0.5) * 400,
                        scale: [0, 1, 0],
                        rotate: Math.random() * 360
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() * 0.5 }}
                      className="absolute"
                    >
                      <Sparkles className={`w-6 h-6 ${i % 2 === 0 ? 'text-orange-500' : 'text-white'}`} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            key="winners"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 z-50"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center gap-2 text-orange-500 font-bold uppercase tracking-[0.4em] text-sm mb-12"
            >
              <Sparkles className="w-5 h-5" />
              Final Winners
              <Sparkles className="w-5 h-5" />
            </motion.div>
            
            <div className="flex flex-col gap-6 items-center w-full max-w-md px-8">
              {winners.map((winner, idx) => (
                <motion.div
                  key={winner.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.3, type: "spring" }}
                  className="w-full flex items-center justify-between bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-2xl border border-orange-500/20">
                      👑
                    </div>
                    <span className="text-2xl font-black italic text-white tracking-tight">{winner.ign}</span>
                  </div>
                  <Trophy className="w-8 h-8 text-orange-500" />
                </motion.div>
              ))}
            </div>
            
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              onClick={onClose || onComplete}
              className="mt-12 text-zinc-500 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors"
            >
              Close Results
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
