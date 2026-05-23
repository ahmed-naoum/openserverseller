import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  type = 'warning'
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          {/* Glass backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-slate-100 overflow-hidden z-10"
          >
            {/* Header Accent */}
            <div className={`h-1.5 w-full ${
              type === 'danger' 
                ? 'bg-rose-500' 
                : type === 'warning' 
                ? 'bg-amber-500' 
                : 'bg-primary-500'
            }`} />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <X size={16} />
            </button>

            <div className="p-6 sm:p-8">
              {/* Icon & Title */}
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl flex-shrink-0 ${
                  type === 'danger' 
                    ? 'bg-rose-50 text-rose-600' 
                    : type === 'warning' 
                    ? 'bg-amber-50 text-amber-600' 
                    : 'bg-primary-50 text-primary-600'
                }`}>
                  {type === 'danger' ? (
                    <AlertTriangle size={24} className="animate-bounce" />
                  ) : (
                    <HelpCircle size={24} />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-snug">
                    {title}
                  </h3>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed mt-2">
                    {message}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-8">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-black text-slate-600 transition-all hover:scale-98 active:scale-95"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-all hover:scale-98 active:scale-95 ${
                    type === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100 hover:shadow-lg'
                      : type === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100 hover:shadow-lg'
                      : 'bg-primary-600 hover:bg-primary-700 shadow-primary-100 hover:shadow-lg'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
