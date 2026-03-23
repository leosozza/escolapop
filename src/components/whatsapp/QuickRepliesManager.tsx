import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut: string;
  is_global: boolean;
  created_by: string;
}

interface QuickRepliesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRepliesChanged: () => void;
}

export function QuickRepliesManager({ open, onOpenChange, onRepliesChanged }: QuickRepliesManagerProps) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', shortcut: '', is_global: false });
  const [loading, setLoading] = useState(false);

  const fetchReplies = async () => {
    const { data } = await supabase
      .from('whatsapp_quick_replies' as any)
      .select('*')
      .order('title');
    if (data) setReplies(data as any);
  };

  useEffect(() => {
    if (open) fetchReplies();
  }, [open]);

  const startNew = () => {
    setForm({ title: '', content: '', shortcut: '', is_global: false });
    setEditing(null);
    setIsNew(true);
  };

  const startEdit = (r: QuickReply) => {
    setForm({ title: r.title, content: r.content, shortcut: r.shortcut, is_global: r.is_global });
    setEditing(r);
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.shortcut.trim()) {
      toast.error('Preencha título, atalho e conteúdo');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      if (editing) {
        const { error } = await supabase
          .from('whatsapp_quick_replies' as any)
          .update({ title: form.title, content: form.content, shortcut: form.shortcut.replace(/^\//, ''), is_global: form.is_global, updated_at: new Date().toISOString() } as any)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Resposta atualizada');
      } else {
        const { error } = await supabase
          .from('whatsapp_quick_replies' as any)
          .insert({ title: form.title, content: form.content, shortcut: form.shortcut.replace(/^\//, ''), is_global: form.is_global, created_by: user.id } as any);
        if (error) throw error;
        toast.success('Resposta criada');
      }
      setIsNew(false);
      setEditing(null);
      fetchReplies();
      onRepliesChanged();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta resposta rápida?')) return;
    const { error } = await supabase.from('whatsapp_quick_replies' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Excluída');
    fetchReplies();
    onRepliesChanged();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle>Respostas Rápidas</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {isNew ? (
            <div className="space-y-3 border rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{editing ? 'Editar' : 'Nova'} Resposta</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setIsNew(false); setEditing(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Boas-vindas" />
              </div>
              <div>
                <Label className="text-xs">Atalho (sem /)</Label>
                <Input value={form.shortcut} onChange={e => setForm(f => ({ ...f, shortcut: e.target.value }))} placeholder="boas-vindas" />
              </div>
              <div>
                <Label className="text-xs">Conteúdo</Label>
                <Textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Olá {nome}! Tudo bem? 😊"
                  rows={4}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Variáveis: {'{nome}'}, {'{nome_completo}'}, {'{curso}'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_global} onCheckedChange={v => setForm(f => ({ ...f, is_global: v }))} />
                <Label className="text-xs">Disponível para todos</Label>
              </div>
              <Button onClick={handleSave} disabled={loading} className="w-full" size="sm">
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          ) : (
            <Button onClick={startNew} variant="outline" className="w-full" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Resposta
            </Button>
          )}

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {replies.map(r => (
              <div key={r.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">/{r.shortcut}</span>
                    <span className="text-sm font-medium">{r.title}</span>
                    {r.is_global && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Global</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(r)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>
              </div>
            ))}
            {replies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma resposta rápida cadastrada</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
