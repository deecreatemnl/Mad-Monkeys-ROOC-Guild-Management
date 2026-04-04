import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles, Waves } from 'lucide-react';

interface RaffleAnimationProps {
  entries: any[];
  winners: any[];
  onComplete?: () => void;
}

export default function RaffleAnimation({ entries, winners, onComplete }: RaffleAnimationProps) {
  const [isRacing, setIsRacing] = useState(true);
  const [showWinners, setShowWinners] = useState(false);
  const [duckPositions, setDuckPositions] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize ducks with random speeds and starting positions
  useEffect(() => {
    const initialDucks = entries.map((entry, index) => ({
      ...entry,
      speed: 0.5 + Math.random() * 1.5,
      offsetY: (index * 25) % 150 + 20,
      progress: 0,
      isWinner: winners.some(w => w.id === entry.id)
    }));
    setDuckPositions(initialDucks);
  }, [entries, winners]);

  // Animation loop
  useEffect(() => {
    if (isRacing && duckPositions.length > 0) {
      const interval = setInterval(() => {
        setDuckPositions(prev => {
          const next = prev.map(duck => {
            if (duck.progress >= 100) return duck;
            
            // Winners move slightly faster towards the end
            const boost = (duck.isWinner && duck.progress > 70) ? 1.5 : 1;
            const newProgress = duck.progress + (duck.speed * boost * 0.5);
            
            return {
              ...duck,
              progress: Math.min(newProgress, 100)
            };
          });

          // Check if all winners have finished
          const allWinnersFinished = next.filter(d => d.isWinner).every(d => d.progress >= 100);
          if (allWinnersFinished) {
            setTimeout(() => {
              setIsRacing(false);
              setTimeout(() => setShowWinners(true), 1000);
            }, 500);
          }

          return next;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [isRacing, duckPositions.length]);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto aspect-[21/9] bg-blue-600 rounded-3xl border-4 border-blue-400/30 overflow-hidden shadow-2xl shadow-blue-500/10">
      {/* Water background with waves */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 flex flex-col justify-around">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ x: [-20, 20, -20] }}
              transition={{ duration: 3 + i, repeat: Infinity, ease: "linear" }}
              className="w-[120%] h-px bg-white/50"
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isRacing ? (
          <div className="absolute inset-0 p-4">
            {/* Finish Line */}
            <div className="absolute right-12 top-0 bottom-0 w-2 border-r-4 border-dashed border-white/30 flex flex-col justify-around items-center py-4">
              <div className="w-4 h-4 bg-white rounded-full" />
              <div className="w-4 h-4 bg-white rounded-full" />
              <div className="w-4 h-4 bg-white rounded-full" />
            </div>

            {/* Ducks */}
            {duckPositions.map((duck) => (
              <motion.div
                key={duck.id}
                style={{ 
                  left: `${duck.progress}%`,
                  top: `${duck.offsetY}px`,
                  zIndex: duck.isWinner ? 10 : 1
                }}
                className="absolute flex flex-col items-center gap-1 -translate-x-1/2 transition-all duration-50 ease-linear"
              >
                <div className="text-2xl filter drop-shadow-md">
                  {duck.isWinner ? '👑' : '🦆'}
                </div>
                <div className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap border border-white/10">
                  {duck.ign}
                </div>
              </motion.div>
            ))}

            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-900/80 backdrop-blur-md px-4 py-1 rounded-full border border-blue-400/30 text-[10px] font-bold text-blue-200 uppercase tracking-widest">
              The Great Duck Race
            </div>
          </div>
        ) : showWinners ? (
          <motion.div
            key="winners"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md z-50"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center gap-2 text-orange-500 font-bold uppercase tracking-widest text-sm mb-6"
            >
              <Sparkles className="w-4 h-4" />
              Winners Selected
              <Sparkles className="w-4 h-4" />
            </motion.div>
            
            <div className="flex flex-col gap-3 items-center w-full max-w-sm px-6">
              {winners.map((winner, idx) => (
                <motion.div
                  key={winner.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.2 }}
                  className="w-full flex items-center justify-between bg-zinc-900 p-4 rounded-2xl border border-orange-500/30 shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center text-xl">
                      👑
                    </div>
                    <span className="text-xl font-bold text-white">{winner.ign}</span>
                  </div>
                  <Trophy className="w-6 h-6 text-yellow-500" />
                </motion.div>
              ))}
            </div>

            <button
              onClick={() => {
                setIsRacing(true);
                setShowWinners(false);
                // Reset positions
                setDuckPositions(prev => prev.map(d => ({ ...d, progress: 0 })));
              }}
              className="mt-8 text-xs text-zinc-500 hover:text-zinc-300 underline font-medium"
            >
              Replay Race
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="finish"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-blue-500/20"
          >
            <div className="text-4xl font-black text-white italic tracking-tighter drop-shadow-lg">
              FINISH!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Water ripples */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-blue-900/50 to-transparent pointer-events-none" />
    </div>
  );
}
