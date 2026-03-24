import { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle, Check, CheckCheck, Clock, Download, FileIcon, Play, Pause } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  phone: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
  wuzapi_message_id: string | null;
  reaction_to_id: string | null;
}

interface WhatsAppMessageListProps {
  phone: string;
  leadId?: string;
}

function isValidMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

export function WhatsAppMessageList({ phone, leadId }: WhatsAppMessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const cleanPhone = phone.replace(/\D/g, '');

  const fetchMessages = async () => {
    let query = supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200);

    if (leadId) {
      query = query.eq('lead_id', leadId);
    } else {
      query = query.or(`phone.eq.${cleanPhone},phone.eq.55${cleanPhone},phone.like.%${cleanPhone.slice(-8)}%`);
    }

    const { data } = await query;
    setMessages((data as Message[]) || []);
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`whatsapp-messages-${cleanPhone}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const newMsg = payload.new as Message;
        const msgPhone = newMsg.phone.replace(/\D/g, '');
        if (
          msgPhone === cleanPhone ||
          msgPhone === `55${cleanPhone}` ||
          cleanPhone.endsWith(msgPhone.slice(-8))
        ) {
          setMessages((prev) => [...prev, newMsg]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [phone, leadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Separate reactions from regular messages
  const { regularMessages, reactionMap } = useMemo(() => {
    const regular: Message[] = [];
    const reactions = new Map<string, string[]>(); // wuzapi_message_id -> emoji[]

    for (const msg of messages) {
      if (msg.message_type === 'reaction' && msg.reaction_to_id) {
        const existing = reactions.get(msg.reaction_to_id) || [];
        existing.push(msg.content || '');
        reactions.set(msg.reaction_to_id, existing);
      } else {
        regular.push(msg);
      }
    }

    return { regularMessages: regular, reactionMap: reactions };
  }, [messages]);

  if (regularMessages.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Nenhuma mensagem registrada
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="space-y-2 p-3">
        {regularMessages.map((msg) => {
          const isOutbound = msg.direction === 'outbound';
          const isFailed = msg.status === 'failed';
          const reactions = msg.wuzapi_message_id ? reactionMap.get(msg.wuzapi_message_id) : undefined;

          return (
            <div key={msg.id} className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
              <div className="relative max-w-[75%]">
                <div
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm',
                    isOutbound
                      ? isFailed
                        ? 'bg-destructive/10 border border-destructive/30 text-destructive'
                        : 'bg-green-600 text-white'
                      : 'bg-muted'
                  )}
                >
                  <MessageContent msg={msg} isOutbound={isOutbound} />
                  <div className={cn('flex items-center gap-1 mt-1', isOutbound ? 'justify-end' : 'justify-start')}>
                    <span className={cn('text-[10px]', isOutbound && !isFailed ? 'text-green-200' : 'text-muted-foreground')}>
                      {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                    </span>
                    {isOutbound && (
                      isFailed ? (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      ) : msg.status === 'read' ? (
                        <CheckCheck className="h-3 w-3 text-blue-400" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="h-3 w-3 text-green-200" />
                      ) : msg.status === 'sent' ? (
                        <Check className="h-3 w-3 text-green-200" />
                      ) : (
                        <Clock className="h-3 w-3 text-green-200" />
                      )
                    )}
                  </div>
                  {isFailed && msg.error_message && (
                    <p className="text-[10px] text-destructive mt-1">{msg.error_message}</p>
                  )}
                </div>
                {/* Reaction badges */}
                {reactions && reactions.length > 0 && (
                  <div className={cn(
                    'flex gap-0.5 -mt-1.5 relative z-10',
                    isOutbound ? 'justify-end pr-1' : 'justify-start pl-1'
                  )}>
                    <div className="flex items-center gap-0.5 bg-background border rounded-full px-1.5 py-0.5 shadow-sm">
                      {groupReactions(reactions).map(({ emoji, count }) => (
                        <span key={emoji} className="text-xs">
                          {emoji}{count > 1 && <span className="text-[10px] text-muted-foreground ml-0.5">{count}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function groupReactions(emojis: string[]): { emoji: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of emojis) {
    if (e) map.set(e, (map.get(e) || 0) + 1);
  }
  return Array.from(map.entries()).map(([emoji, count]) => ({ emoji, count }));
}

function InlineAudioPlayer({ src, isOutbound }: { src: string; isOutbound: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setIsPlaying(false));
    }
    setIsPlaying(!isPlaying);
  };

  const formatSec = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a) {
            setCurrentTime(a.currentTime);
            setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
          }
        }}
        onEnded={() => { setIsPlaying(false); setProgress(0); setCurrentTime(0); }}
        onError={() => setIsPlaying(false)}
      />
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8 rounded-full shrink-0', isOutbound ? 'text-white hover:bg-green-700' : 'hover:bg-muted-foreground/20')}
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="h-1 rounded-full bg-background/30 overflow-hidden">
          <div className="h-full rounded-full bg-current transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className={cn('text-[10px]', isOutbound ? 'text-green-200' : 'text-muted-foreground')}>
          {isPlaying ? formatSec(currentTime) : formatSec(duration)}
        </span>
      </div>
    </div>
  );
}

function FormattedText({ text, className }: { text: string; className?: string }) {
  const formatted = text
    .replace(/```([^`]+)```/g, '<code class="bg-background/20 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<s>$1</s>');

  return <p className={cn('whitespace-pre-wrap break-words', className)} dangerouslySetInnerHTML={{ __html: formatted }} />;
}

function MessageContent({ msg, isOutbound }: { msg: Message; isOutbound: boolean }) {
  const type = msg.message_type;
  const hasValidMedia = isValidMediaUrl(msg.media_url);

  if (type === 'audio') {
    if (hasValidMedia) {
      return (
        <div>
          <InlineAudioPlayer src={msg.media_url!} isOutbound={isOutbound} />
          {msg.content && msg.content !== '[Mídia recebida]' && msg.content !== '🎤 Áudio' && (
            <p className="whitespace-pre-wrap break-words mt-1 text-xs opacity-80">{msg.content}</p>
          )}
        </div>
      );
    }
    // No valid URL — show fallback
    return (
      <div className="flex items-center gap-2 text-xs opacity-70">
        <Play className="h-4 w-4" />
        <span>🎤 Áudio (mídia indisponível)</span>
      </div>
    );
  }

  if (type === 'image') {
    if (hasValidMedia) {
      return (
        <div>
          <img
            src={msg.media_url!}
            alt="Imagem"
            className="rounded-lg max-w-[260px] max-h-[300px] object-cover cursor-pointer"
            onClick={() => window.open(msg.media_url!, '_blank')}
          />
          {msg.content && msg.content !== '[Mídia recebida]' && msg.content !== '📷 Imagem' && (
            <FormattedText text={msg.content} className="mt-1" />
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs opacity-70">
        <FileIcon className="h-4 w-4" />
        <span>📷 Imagem (mídia indisponível)</span>
      </div>
    );
  }

  if (type === 'video') {
    if (hasValidMedia) {
      return (
        <div>
          <video controls className="rounded-lg max-w-[260px] max-h-[300px]" preload="metadata">
            <source src={msg.media_url!} />
          </video>
          {msg.content && msg.content !== '[Mídia recebida]' && msg.content !== '🎬 Vídeo' && (
            <FormattedText text={msg.content} className="mt-1" />
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs opacity-70">
        <Play className="h-4 w-4" />
        <span>🎬 Vídeo (mídia indisponível)</span>
      </div>
    );
  }

  if (type === 'document' && hasValidMedia) {
    return (
      <a href={msg.media_url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-background/20 hover:bg-background/30 transition-colors">
        <FileIcon className="h-8 w-8 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{msg.content || 'Documento'}</p>
        </div>
        <Download className="h-4 w-4 shrink-0 opacity-60" />
      </a>
    );
  }

  return <FormattedText text={msg.content || '[sem conteúdo]'} />;
}
