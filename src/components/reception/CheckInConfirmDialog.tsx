import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, User, Clock, Calendar, Phone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  lead: {
    full_name: string;
    phone: string;
    email: string | null;
  } | null;
  agent: {
    full_name: string;
  } | null;
}

interface CheckInConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onConfirm: (attended: boolean) => void;
}

export function CheckInConfirmDialog({ 
  open, 
  onOpenChange, 
  appointment,
  onConfirm 
}: CheckInConfirmDialogProps) {
  if (!appointment) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Check-in</DialogTitle>
          <DialogDescription>
            Confirme o check-in do visitante
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Visitor Info Card */}
          <div className="flex flex-col items-center gap-4 p-6 bg-muted/30 rounded-xl border">
            <Avatar className="h-20 w-20 ring-4 ring-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {appointment.lead ? getInitials(appointment.lead.full_name) : '?'}
              </AvatarFallback>
            </Avatar>

            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground">
                {appointment.lead?.full_name || 'Visitante'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {appointment.lead?.email || 'Sem email'}
              </p>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 mt-2">
              <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                <Calendar className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-medium">
                    {format(new Date(appointment.scheduled_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="text-sm font-medium">
                    {appointment.scheduled_time.slice(0, 5)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-background rounded-lg col-span-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="text-sm font-medium">
                    {appointment.lead?.phone || 'N/A'}
                  </p>
                </div>
              </div>

              {appointment.agent && (
                <div className="flex items-center gap-2 p-3 bg-background rounded-lg col-span-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Atendente</p>
                    <p className="text-sm font-medium">
                      {appointment.agent.full_name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onConfirm(false)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Não Compareceu
          </Button>
          <Button
            className="flex-1 bg-success hover:bg-success/90 text-white"
            onClick={() => onConfirm(true)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Confirmar Check-in
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
