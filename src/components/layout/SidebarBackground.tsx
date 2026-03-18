import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import bg1 from '@/assets/sidebar-bg/1.png';
import bg2 from '@/assets/sidebar-bg/2.png';
import bg3 from '@/assets/sidebar-bg/3.png';
import bg4 from '@/assets/sidebar-bg/4.png';
import bg5 from '@/assets/sidebar-bg/5.png';
import bg6 from '@/assets/sidebar-bg/6.png';
import bg7 from '@/assets/sidebar-bg/7.png';
import bg8 from '@/assets/sidebar-bg/8.png';
import bg9 from '@/assets/sidebar-bg/9.png';

const routeBackgroundMap: Record<string, string> = {
  '/dashboard': bg1,
  '/crm': bg1,
  '/appointments': bg2,
  '/reception': bg3,
  '/studio': bg4,
  '/producer-queue': bg5,
  '/academic-support': bg6,
  '/students': bg7,
  '/classes': bg8,
  '/courses': bg8,
  '/lms': bg8,
  '/certificates': bg8,
  '/billing': bg9,
  '/contracts': bg9,
  '/payments': bg9,
  '/overdue': bg9,
};

export function SidebarBackground() {
  const location = useLocation();
  const bgImage = routeBackgroundMap[location.pathname] || bg1;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      <AnimatePresence mode="wait">
        <motion.img
          key={bgImage}
          src={bgImage}
          alt=""
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 0.18, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute bottom-0 left-0 w-full h-auto object-cover object-bottom"
        />
      </AnimatePresence>
    </div>
  );
}
