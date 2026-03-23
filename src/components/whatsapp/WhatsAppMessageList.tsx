import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Check, CheckCheck, Clock, Download, FileIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
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
}

interface WhatsAppMessageListProps {
  phone: string;
  leadId?: string;
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
      .limit(100);

    if (leadId) {
      query = query.eq('lead_id', leadId);
    } else {
      query = query.or(`phone.eq.${cleanPhone},phone.eq.55${cleanPhone},phone.like.%${cleanPhone.slice(-8)}%`);
    }

    const { data } = await query;
    setMessages(data || []);
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

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Nenhuma mensagem registrada
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="space-y-2 p-3">
        {messages.map((msg) => {
          const isOutbound = msg.direction === 'outbound';
          const isFailed = msg.status === 'failed';

          return (
            <div key={msg.id} className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[75%] rounded-xl px-3 py-2 text-sm',
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
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function MessageContent({ msg, isOutbound }: { msg: Message; isOutbound: boolean }) {
  const type = msg.message_type;

  if (type === 'audio' && msg.media_url) {
    return (
      <div className="min-w-[200px]">
        <audio controls className="w-full max-w-[280px] h-8" preload="none">
          <source src={msg.media_url} />
        </audio>
        {msg.content && msg.content !== '[Mídia recebida]' && (
          <p className="whitespace-pre-wrap break-words mt-1 text-xs opacity-80">{msg.content}</p>
        )}
      </div>
    );
  }

  if (type === 'image' && msg.media_url) {
    return (
      <div>
        <img
          src={msg.media_url}
          alt="Imagem"
          className="rounded-lg max-w-[260px] max-h-[300px] object-cover cursor-pointer"
          onClick={() => window.open(msg.media_url!, '_blank')}
        />
        {msg.content && msg.content !== '[Mídia recebida]' && (
          <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>
        )}
      </div>
    );
  }

  if (type === 'video' && msg.media_url) {
    return (
      <div>
        <video controls className="rounded-lg max-w-[260px] max-h-[300px]" preload="none">
          <source src={msg.media_url} />
        </video>
        {msg.content && msg.content !== '[Mídia recebida]' && (
          <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>
        )}
      </div>
    );
  }

  if (type === 'document' && msg.media_url) {
    return (
      <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-background/20 hover:bg-background/30 transition-colors">
        <FileIcon className="h-8 w-8 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{msg.content || 'Documento'}</p>
        </div>
        <Download className="h-4 w-4 shrink-0 opacity-60" />
      </a>
    );
  }

  return <p className="whitespace-pre-wrap break-words">{msg.content || '[sem conteúdo]'}</p>;
}
