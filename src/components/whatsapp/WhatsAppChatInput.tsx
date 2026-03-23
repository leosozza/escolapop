import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Mic, X, Paperclip, FileIcon, ImageIcon, Zap, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { QuickReplyPopup } from './QuickReplyPopup';
import { QuickRepliesManager } from './QuickRepliesManager';

interface WhatsAppChatInputProps {
  phone: string;
  leadId?: string;
  instanceId?: string;
  onMessageSent?: () => void;
  leadName?: string;
  courseName?: string;
}

interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut: string;
}

export function WhatsAppChatInput({ phone, leadId, instanceId, onMessageSent, leadName, courseName }: WhatsAppChatInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState('');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showManager, setShowManager] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchQuickReplies = useCallback(async () => {
    const { data } = await supabase.from('whatsapp_quick_replies' as any).select('id, title, content, shortcut').order('title');
    if (data) setQuickReplies(data as any);
  }, []);

  useEffect(() => { fetchQuickReplies(); }, [fetchQuickReplies]);

  const replaceVariables = (text: string) => {
    const firstName = leadName?.split(' ')[0] || '';
    return text
      .replace(/\{nome\}/g, firstName)
      .replace(/\{nome_completo\}/g, leadName || '')
      .replace(/\{curso\}/g, courseName || '');
  };

  const handleQuickReplySelect = (reply: QuickReply) => {
    const content = replaceVariables(reply.content);
    setMessage(content);
    setShowQuickReplies(false);
    setQuickReplyFilter('');
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    if (val.startsWith('/') && val.length >= 1) {
      setShowQuickReplies(true);
      setQuickReplyFilter(val.slice(1));
    } else {
      setShowQuickReplies(false);
      setQuickReplyFilter('');
    }
  };

  const handleSend = async () => {
    if (selectedFile) { await handleSendFile(); return; }
    if (!message.trim()) return;
    if (!instanceId) { toast.error('Selecione uma instância WhatsApp'); return; }
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'send-text', instanceId, phone, message: message.trim(), leadId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Mensagem enviada!');
        setMessage('');
        onMessageSent?.();
      } else {
        toast.error(data?.error || 'Erro ao enviar mensagem');
      }
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Erro ao enviar. Verifique a conexão WhatsApp.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showQuickReplies) return; // let popup handle keys
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/ogg; codecs=opus') ? 'audio/ogg; codecs=opus' : 'audio/webm; codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch { toast.error('Não foi possível acessar o microfone'); }
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !instanceId) return;
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        recorder.stream?.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size === 0) { resolve(); return; }
        setIsSending(true);
        try {
          const base64 = await blobToBase64(blob);
          const { data, error } = await supabase.functions.invoke('whatsapp-api', {
            body: { action: 'send-audio', instanceId, phone, audio: base64, leadId },
          });
          if (error) throw error;
          if (data?.success) { toast.success('Áudio enviado!'); onMessageSent?.(); }
          else toast.error(data?.error || 'Erro ao enviar áudio');
        } catch { toast.error('Erro ao enviar áudio'); }
        finally { setIsSending(false); }
        resolve();
      };
      recorder.stop();
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    chunksRef.current = [];
  };

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error('Arquivo excede 16MB'); return; }
    setSelectedFile(file);
  };

  const handleSendFile = async () => {
    if (!selectedFile || !instanceId) return;
    setIsSending(true);
    try {
      const base64 = await blobToBase64(selectedFile);
      const isImage = selectedFile.type.startsWith('image/');
      const isAudio = selectedFile.type.startsWith('audio/');
      const action = isImage ? 'send-image' : isAudio ? 'send-audio' : 'send-document';
      const body: Record<string, unknown> = { action, instanceId, phone, leadId };
      if (isImage) { body.image = base64; body.caption = message.trim() || undefined; }
      else if (isAudio) { body.audio = base64; }
      else { body.document = base64; body.fileName = selectedFile.name; body.caption = message.trim() || undefined; }
      const { data, error } = await supabase.functions.invoke('whatsapp-api', { body });
      if (error) throw error;
      if (data?.success) { toast.success('Arquivo enviado!'); setSelectedFile(null); setMessage(''); onMessageSent?.(); }
      else toast.error(data?.error || 'Erro ao enviar arquivo');
    } catch { toast.error('Erro ao enviar arquivo'); }
    finally { setIsSending(false); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (isRecording) {
    return (
      <div className="flex gap-2 items-center border-t pt-3 px-1">
        <Button variant="ghost" size="icon" onClick={cancelRecording} className="text-destructive h-9 w-9">
          <X className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-mono text-destructive">{formatTime(recordingTime)}</span>
          <span className="text-xs text-muted-foreground">Gravando áudio...</span>
        </div>
        <Button onClick={stopAndSendRecording} disabled={isSending} size="icon" className="h-9 w-9 bg-green-600 hover:bg-green-700">
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="border-t pt-3 space-y-2 px-1">
        {selectedFile && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-xs">
            {selectedFile.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-blue-500" /> : <FileIcon className="h-4 w-4 text-muted-foreground" />}
            <span className="flex-1 truncate">{selectedFile.name}</span>
            <span className="text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)}KB</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSelectedFile(null)}><X className="h-3 w-3" /></Button>
          </div>
        )}
        <div className="relative flex gap-2 items-end">
          {showQuickReplies && (
            <QuickReplyPopup
              replies={quickReplies}
              filter={quickReplyFilter}
              onSelect={handleQuickReplySelect}
              onClose={() => { setShowQuickReplies(false); setQuickReplyFilter(''); }}
            />
          )}
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isSending || !instanceId}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => { setShowQuickReplies(!showQuickReplies); setQuickReplyFilter(''); }} disabled={isSending || !instanceId} title="Respostas rápidas">
            <Zap className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowManager(true)} disabled={!instanceId} title="Gerenciar respostas">
            <Settings className="h-4 w-4" />
          </Button>
          <Textarea
            placeholder={instanceId ? "Digite / para respostas rápidas..." : "Selecione uma instância"}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="resize-none flex-1 min-h-[36px] text-sm"
            disabled={isSending || !instanceId}
          />
          {message.trim() || selectedFile ? (
            <Button onClick={handleSend} disabled={(!message.trim() && !selectedFile) || isSending || !instanceId} size="icon" className="h-9 w-9 shrink-0 bg-green-600 hover:bg-green-700">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          ) : (
            <Button onClick={startRecording} disabled={isSending || !instanceId} size="icon" variant="ghost" className="h-9 w-9 shrink-0">
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <QuickRepliesManager open={showManager} onOpenChange={setShowManager} onRepliesChanged={fetchQuickReplies} />
    </>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
