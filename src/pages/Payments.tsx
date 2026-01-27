import { useState, useEffect } from 'react';
import {
  Search,
  CreditCard,
  DollarSign,
  Calendar,
  Loader2,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  contract_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  contract?: {
    enrollment?: {
      lead?: { full_name: string };
      course?: { name: string };
    };
  };
}

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning', icon: Clock },
  pago: { label: 'Pago', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  atrasado: { label: 'Atrasado', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  cancelado: { label: 'Cancelado', color: 'bg-muted text-muted-foreground', icon: Clock },
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          contract:contracts(
            enrollment:enrollments(
              lead:leads!enrollments_lead_id_fkey(full_name),
              course:courses(name)
            )
          )
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      // Update status based on due date
      const updatedPayments = ((data || []) as Payment[]).map((p) => {
        if (p.status === 'pendente' && isPast(new Date(p.due_date)) && !isToday(new Date(p.due_date))) {
          return { ...p, status: 'atrasado' as const };
        }
        return p;
      });
      
      setPayments(updatedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar pagamentos',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsPaid = async (payment: Payment) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'pago',
          paid_at: new Date().toISOString(),
          paid_amount: payment.amount,
        })
        .eq('id', payment.id);

      if (error) throw error;

      toast({
        title: 'Pagamento registrado!',
        description: `Parcela ${payment.installment_number} marcada como paga.`,
      });

      fetchPayments();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Tente novamente.',
      });
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.contract?.enrollment?.lead?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contract?.enrollment?.course?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: payments.length,
    pendentes: payments.filter(p => p.status === 'pendente').length,
    pagos: payments.filter(p => p.status === 'pago').length,
    atrasados: payments.filter(p => p.status === 'atrasado').length,
    valorPendente: payments
      .filter(p => p.status === 'pendente' || p.status === 'atrasado')
      .reduce((acc, p) => acc + Number(p.amount), 0),
    valorRecebido: payments
      .filter(p => p.status === 'pago')
      .reduce((acc, p) => acc + Number(p.paid_amount || p.amount), 0),
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
          <h1 className="text-3xl font-bold tracking-tight">Pagamentos</h1>
          <p className="text-muted-foreground">
            Controle de parcelas e recebimentos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="pago">Pagos</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendentes}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
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
                <p className="text-2xl font-bold">{stats.atrasados}</p>
                <p className="text-sm text-muted-foreground">Atrasados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorRecebido)}</p>
                <p className="text-sm text-muted-foreground">Recebido</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorPendente)}</p>
                <p className="text-sm text-muted-foreground">A Receber</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <CreditCard className="mx-auto h-12 w-12 opacity-50 mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum pagamento encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => {
                  const statusConfig = STATUS_CONFIG[payment.status];
                  const StatusIcon = statusConfig.icon;
                  const isOverdue = payment.status === 'atrasado';
                  
                  return (
                    <TableRow key={payment.id} className={cn(isOverdue && 'bg-destructive/5')}>
                      <TableCell className="font-medium">
                        {payment.contract?.enrollment?.lead?.full_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {payment.contract?.enrollment?.course?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payment.installment_number}ª parcela
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className={cn(
                          'flex items-center gap-2 text-sm',
                          isOverdue && 'text-destructive font-medium'
                        )}>
                          <Calendar className="h-3 w-3" />
                          {format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(payment.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(payment.status === 'pendente' || payment.status === 'atrasado') && (
                              <DropdownMenuItem onClick={() => markAsPaid(payment)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Marcar como pago
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
