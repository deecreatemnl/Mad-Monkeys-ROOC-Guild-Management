import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles } from 'lucide-react';

interface RaffleAnimationProps {
  entries: any[];
  winners: any[];
  onComplete?: () => void;
}

export default function RaffleAnimation({ entries, winners, onComplete }: RaffleAnimationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [showWinners, setShowWinners] = useState(false);

  useEffect(() => {
    if (isSpinning) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % entries.length);
      }, 100);

      const timeout = setTimeout(() => {
        setIsSpinning(false);
        clearInterval(interval);
        setTimeout(() => setShowWinners(true), 1000);
      }, 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isSpinning, entries.length]);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-video bg-zinc-900 rounded-3xl border-4 border-orange-500/30 overflow-hidden flex items-center justify-center shadow-2xl shadow-orange-500/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />
      
      <AnimatePresence mode="wait">
        {isSpinning ? (
          <motion.div
            key="spinning"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="text-4xl font-black text-white tracking-tighter italic"
          >
            {entries[currentIndex]?.ign}
          </motion.div>
        ) : showWinners ? (
          <motion.div
            key="winners"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex items-center gap-2 text-orange-500 font-bold uppercase tracking-widest text-sm">
              <Sparkles className="w-4 h-4" />
              Winners Selected
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-2 items-center">
              {winners.map((winner, idx) => (
                <motion.div
                  key={winner.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.3 }}
                  className="flex items-center gap-3 bg-zinc-800 px-6 py-3 rounded-2xl border border-orange-500/50 shadow-lg"
                >
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl font-bold text-white">{winner.ign}</span>
                </motion.div>
              ))}
            </div>
            <button
              onClick={() => {
                setIsSpinning(true);
                setShowWinners(false);
              }}
              className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 underline"
            >
              Replay Animation
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="final"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.5 }}
            className="text-5xl font-black text-orange-500 italic"
          >
            DRAWN!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative elements */}
      <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-orange-500 animate-ping" />
      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-orange-500 animate-ping delay-300" />
      <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-orange-500 animate-ping delay-700" />
      <div className="absolute bottom-4 right-4 w-2 h-2 rounded-full bg-orange-500 animate-ping delay-500" />
    </div>
  );
}
