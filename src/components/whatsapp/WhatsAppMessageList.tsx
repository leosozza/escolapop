import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertCircle, Check, CheckCheck, Clock, Download, FileIcon, Play, FileText, Loader2, RefreshCw, Reply, Copy, Trash2 } from 'lucide-react';
import { WaveSurferPlayer } from './WaveSurferPlayer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export interface ReplyToMessage {
  id: string;
  content: string | null;
  message_type: string;
  direction: string;
}

interface WhatsAppMessageListProps {
  phone: string;
  leadId?: string;
  instanceId?: string;
  onReply?: (msg: ReplyToMessage) => void;
}

function isValidMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

function getMessagePreview(msg: Message): string {
  if (msg.message_type === 'audio') return '🎤 Áudio';
  if (msg.message_type === 'image') return '📷 Imagem';
  if (msg.message_type === 'video') return '🎬 Vídeo';
  if (msg.message_type === 'document') return '📄 Documento';
  return msg.content || '[sem conteúdo]';
}

export function WhatsAppMessageList({ phone, leadId, instanceId, onReply }: WhatsAppMessageListProps) {
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
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const deleted = payload.old as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [phone, leadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const { regularMessages, reactionMap } = useMemo(() => {
    const regular: Message[] = [];
    const reactions = new Map<string, string[]>();

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

  const hasMediaWithoutUrl = useMemo(() => {
    return regularMessages.some(
      (m) => ['audio', 'image', 'video', 'document'].includes(m.message_type) && !m.media_url
    );
  }, [regularMessages]);

  const [isReprocessing, setIsReprocessing] = useState(false);

  const handleReprocessMedia = useCallback(async () => {
    if (isReprocessing) return;
    setIsReprocessing(true);
    try {
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('status', 'connected')
        .limit(1);

      const instId = instances?.[0]?.id;
      if (!instId) {
        toast.error('Nenhuma instância WhatsApp conectada');
        return;
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'reprocess-media', instanceId: instId, phone: cleanPhone }),
      });

      const data = await resp.json();
      if (data.processed > 0) {
        toast.success(`${data.processed} mídia(s) recuperada(s)`);
        fetchMessages();
      } else {
        toast.info('Nenhuma mídia pôde ser recuperada');
      }
    } catch {
      toast.error('Erro ao reprocessar mídias');
    } finally {
      setIsReprocessing(false);
    }
  }, [isReprocessing, cleanPhone, fetchMessages]);

  const handleCopy = useCallback((msg: Message) => {
    const text = msg.content || '';
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Mensagem copiada');
    }).catch(() => {
      toast.error('Erro ao copiar');
    });
  }, []);

  const handleDeleteForMe = useCallback(async (msg: Message) => {
    // Just remove from local DB
    const { error } = await supabase.from('whatsapp_messages').delete().eq('id', msg.id);
    if (error) {
      toast.error('Erro ao excluir mensagem');
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      toast.success('Mensagem excluída para você');
    }
  }, []);

  const handleDeleteForAll = useCallback(async (msg: Message) => {
    if (!instanceId) {
      toast.error('Selecione uma instância WhatsApp');
      return;
    }
    if (!msg.wuzapi_message_id) {
      toast.error('Não é possível revogar esta mensagem');
      return;
    }
    try {
      const resp = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'revoke-message',
          instanceId,
          phone: cleanPhone,
          messageId: msg.wuzapi_message_id,
        },
      });
      if (resp.error) throw resp.error;
      if (resp.data?.success) {
        // Remove from local DB
        await supabase.from('whatsapp_messages').delete().eq('id', msg.id);
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        toast.success('Mensagem apagada para todos');
      } else {
        toast.error(resp.data?.error || 'Erro ao apagar mensagem');
      }
    } catch {
      toast.error('Erro ao apagar mensagem para todos');
    }
  }, [instanceId, cleanPhone]);

  const handleReply = useCallback((msg: Message) => {
    onReply?.({
      id: msg.id,
      content: msg.content,
      message_type: msg.message_type,
      direction: msg.direction,
    });
  }, [onReply]);

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
        {hasMediaWithoutUrl && (
          <div className="flex justify-center pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocessMedia}
              disabled={isReprocessing}
              className="text-xs gap-1.5"
            >
              {isReprocessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {isReprocessing ? 'Reprocessando...' : 'Recuperar mídias'}
            </Button>
          </div>
        )}
        {regularMessages.map((msg) => {
          const isOutbound = msg.direction === 'outbound';
          const isFailed = msg.status === 'failed';
          const reactions = msg.wuzapi_message_id ? reactionMap.get(msg.wuzapi_message_id) : undefined;

          return (
            <ContextMenu key={msg.id}>
              <ContextMenuTrigger asChild>
                <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
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
                      <div className={cn('flex items-center gap-1 mt-1 shrink-0', isOutbound ? 'justify-end' : 'justify-start')}>
                        <span className={cn('text-[10px] whitespace-nowrap shrink-0', isOutbound && !isFailed ? 'text-green-200' : 'text-muted-foreground')}>
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
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem className="gap-2" onClick={() => handleReply(msg)}>
                  <Reply className="h-4 w-4" />
                  Responder
                </ContextMenuItem>
                {msg.message_type === 'text' && msg.content && (
                  <ContextMenuItem className="gap-2" onClick={() => handleCopy(msg)}>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem className="gap-2" onClick={() => handleDeleteForMe(msg)}>
                  <Trash2 className="h-4 w-4" />
                  Excluir para mim
                </ContextMenuItem>
                {isOutbound && msg.wuzapi_message_id && (
                  <ContextMenuItem className="gap-2 text-destructive" onClick={() => handleDeleteForAll(msg)}>
                    <Trash2 className="h-4 w-4" />
                    Apagar para todos
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
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
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleTranscribe = useCallback(async () => {
    if (!msg.media_url || isTranscribing) return;
    setIsTranscribing(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ audioUrl: msg.media_url }),
      });
      const data = await resp.json();
      if (data.transcription) {
        setTranscription(data.transcription);
      } else {
        setTranscription(data.error || 'Falha na transcrição');
      }
    } catch {
      setTranscription('Erro ao transcrever');
    } finally {
      setIsTranscribing(false);
    }
  }, [msg.media_url, isTranscribing]);

  if (type === 'audio') {
    if (hasValidMedia) {
      return (
        <div>
          <WaveSurferPlayer src={msg.media_url!} isOutbound={isOutbound} />
          {msg.content && msg.content !== '[Mídia recebida]' && msg.content !== '🎤 Áudio' && (
            <p className="whitespace-pre-wrap break-words mt-1 text-xs opacity-80">{msg.content}</p>
          )}
          {!transcription && (
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className={cn(
                'flex items-center gap-1 mt-1 text-[10px] opacity-70 hover:opacity-100 transition-opacity',
                isOutbound ? 'text-green-200' : 'text-muted-foreground'
              )}
            >
              {isTranscribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              {isTranscribing ? 'Transcrevendo...' : 'Transcrever'}
            </button>
          )}
          {transcription && (
            <p className={cn('mt-1 text-xs italic whitespace-pre-wrap break-words', isOutbound ? 'text-green-200' : 'text-muted-foreground')}>
              📝 {transcription}
            </p>
          )}
        </div>
      );
    }
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
