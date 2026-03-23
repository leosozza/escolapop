import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut: string;
}

interface QuickReplyPopupProps {
  replies: QuickReply[];
  filter: string;
  onSelect: (reply: QuickReply) => void;
  onClose: () => void;
}

export function QuickReplyPopup({ replies, filter, onSelect, onClose }: QuickReplyPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = replies.filter(r =>
    r.shortcut.toLowerCase().includes(filter.toLowerCase()) ||
    r.title.toLowerCase().includes(filter.toLowerCase())
  ).slice(0, 5);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto"
    >
      {filtered.map((reply, i) => (
        <button
          key={reply.id}
          className={cn(
            "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
            i === selectedIndex && "bg-accent"
          )}
          onMouseDown={(e) => { e.preventDefault(); onSelect(reply); }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">/{reply.shortcut}</span>
            <span className="font-medium">{reply.title}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{reply.content.slice(0, 80)}...</p>
        </button>
      ))}
    </div>
  );
}
