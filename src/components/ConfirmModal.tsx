import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                variant === 'danger' ? 'bg-red-500/10 text-red-500' : 
                variant === 'warning' ? 'bg-orange-500/10 text-orange-500' : 
                'bg-blue-500/10 text-blue-500'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 font-medium hover:bg-zinc-800 hover:text-white transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg ${
                  variant === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 
                  variant === 'warning' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 
                  'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
