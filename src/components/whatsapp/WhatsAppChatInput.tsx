import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppChatInputProps {
  phone: string;
  leadId?: string;
  instanceId?: string;
  onMessageSent?: () => void;
}

export function WhatsAppChatInput({ phone, leadId, instanceId, onMessageSent }: WhatsAppChatInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!instanceId) {
      toast.error('Selecione uma instância WhatsApp');
      return;
    }
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'send-text',
          instanceId,
          phone,
          message: message.trim(),
          leadId,
        },
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end border-t pt-3">
      <Textarea
        placeholder={instanceId ? "Digite sua mensagem... (Enter para enviar)" : "Selecione uma instância para enviar"}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        className="resize-none flex-1"
        disabled={isSending || !instanceId}
      />
      <Button
        onClick={handleSend}
        disabled={!message.trim() || isSending || !instanceId}
        size="icon"
        className="h-10 w-10 shrink-0 bg-green-600 hover:bg-green-700"
      >
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}
