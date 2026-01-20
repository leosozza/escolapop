import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  count: number;
  variant?: 'default' | 'warning' | 'danger';
  className?: string;
  showZero?: boolean;
  pulse?: boolean;
}

export function NotificationBadge({ 
  count, 
  variant = 'danger',
  className,
  showZero = false,
  pulse = true,
}: NotificationBadgeProps) {
  const shouldShow = showZero ? count >= 0 : count > 0;
  
  if (!shouldShow) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  const variantStyles = {
    default: 'bg-primary text-primary-foreground',
    warning: 'bg-yellow-500 text-white',
    danger: 'bg-destructive text-destructive-foreground',
  };

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={count}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 25,
        }}
        className={cn(
          'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center',
          'text-[10px] font-bold leading-none shadow-lg',
          variantStyles[variant],
          pulse && 'animate-pulse',
          className
        )}
      >
        <motion.span
          key={`value-${count}`}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
        >
          {displayCount}
        </motion.span>
      </motion.span>
    </AnimatePresence>
  );
}
