import { useState, useEffect } from 'react';
import { announcementApi } from '../../lib/api';
import { AlertCircle, X, Megaphone, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AnnouncementBanner({ position = 'TOP' }: { position?: 'TOP' | 'BOTTOM' }) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  useEffect(() => {
    fetchAnnouncements();
    // Load dismissed announcements from local storage
    const stored = localStorage.getItem('dismissedAnnouncements');
    if (stored) {
      setDismissedIds(JSON.parse(stored));
    }
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await announcementApi.getMyAnnouncements();
      setAnnouncements(res.data.data);
    } catch (error) {
      console.error('Erreur de chargement des annonces', error);
    }
  };

  const handleDismiss = (id: number) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissedAnnouncements', JSON.stringify(newDismissed));
  };

  const visibleAnnouncements = announcements
    .filter(a => 
      !dismissedIds.includes(a.id) && 
      (a.placement === position || (!a.placement && position === 'TOP'))
    )
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="w-full space-y-2 mb-6">
      <AnimatePresence>
        {visibleAnnouncements.map((announcement) => (
          <motion.div
            key={announcement.id}
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
            className={`relative overflow-hidden rounded-xl border p-4 shadow-sm flex items-start gap-3 ${
              announcement.severity === 'WARNING'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : announcement.severity === 'IMPORTANT'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {announcement.severity === 'WARNING' ? <AlertCircle className="w-5 h-5 text-amber-600" /> :
               announcement.severity === 'IMPORTANT' ? <Megaphone className="w-5 h-5 text-red-600" /> :
               <Info className="w-5 h-5 text-blue-600" />}
            </div>
            
            <div className="flex-1 pr-6">
              <h3 className="text-sm font-bold mb-1">{announcement.title}</h3>
              <p className="text-sm opacity-90">{announcement.content}</p>
            </div>

            {announcement.severity !== 'IMPORTANT' && (
              <button
                onClick={() => handleDismiss(announcement.id)}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
