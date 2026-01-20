import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Phone,
  Mail,
  Calendar,
  Loader2,
  Send,
  DollarSign,
  Clock,
  User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface OverduePayment {
  id: string;
  due_date: string;
  amount: number;
  installment_number: number;
  contract?: {
    enrollment?: {
      student?: { full_name: string; phone: string | null };
      course?: { name: string };
    };
  };
  days_overdue: number;
}

export default function Overdue() {
  const [payments, setPayments] = useState<OverduePayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchOverduePayments();
  }, []);

  const fetchOverduePayments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          due_date,
          amount,
          installment_number,
          contract:contracts(
            enrollment:enrollments(
              student:profiles!enrollments_student_id_fkey(full_name, phone),
              course:courses(name)
            )
          )
        `)
        .eq('status', 'pendente')
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Calculate days overdue
      const overduePayments = (data || []).map((p: any) => ({
        ...p,
        days_overdue: differenceInDays(new Date(), new Date(p.due_date)),
      }));

      setPayments(overduePayments);
    } catch (error) {
      console.error('Error fetching overdue payments:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar inadimplências',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getUrgencyColor = (days: number) => {
    if (days > 30) return 'border-l-destructive bg-destructive/5';
    if (days > 15) return 'border-l-warning bg-warning/5';
    return 'border-l-primary';
  };

  const stats = {
    total: payments.length,
    valorTotal: payments.reduce((acc, p) => acc + Number(p.amount), 0),
    ate15dias: payments.filter(p => p.days_overdue <= 15).length,
    ate30dias: payments.filter(p => p.days_overdue > 15 && p.days_overdue <= 30).length,
    mais30dias: payments.filter(p => p.days_overdue > 30).length,
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inadimplência</h1>
          <p className="text-muted-foreground">
            Parcelas vencidas e ações de cobrança
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Send className="h-4 w-4 mr-2" />
          Enviar Cobranças em Massa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ate15dias}</p>
                <p className="text-sm text-muted-foreground">Até 15 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.ate30dias}</p>
                <p className="text-sm text-muted-foreground">15-30 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.mais30dias}</p>
                <p className="text-sm text-muted-foreground">+30 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <DollarSign className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-sm text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue List */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Parcelas Vencidas</CardTitle>
          <CardDescription>
            Ordenadas por urgência (mais atrasadas primeiro)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="mx-auto h-12 w-12 opacity-50 mb-2" />
              <p className="text-lg font-medium">Nenhuma inadimplência!</p>
              <p className="text-sm">Todos os pagamentos estão em dia.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className={cn(
                      'p-4 rounded-lg border-l-4 transition-colors',
                      getUrgencyColor(payment.days_overdue)
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-gradient-primary text-white">
                            {getInitials(payment.contract?.enrollment?.student?.full_name || 'A')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {payment.contract?.enrollment?.student?.full_name || 'Aluno'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {payment.contract?.enrollment?.course?.name} - Parcela {payment.installment_number}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              Venceu em {format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            <Badge variant="destructive" className="text-xs">
                              {payment.days_overdue} dias atrasado
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-destructive">
                            {formatCurrency(Number(payment.amount))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.contract?.enrollment?.student?.phone && (
                            <Button variant="outline" size="icon">
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="outline" size="icon">
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button size="sm">
                            <Send className="h-4 w-4 mr-2" />
                            Cobrar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
