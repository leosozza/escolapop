import { Clock, Phone, User, Check, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface AppointmentCardProps {
  appointment: {
    id: string;
    scheduled_time: string;
    confirmed: boolean;
    attended: boolean | null;
    notes: string | null;
    lead: {
      full_name: string;
      phone: string;
    };
    agent: {
      full_name: string;
    };
  };
  onConfirm: () => void;
  onAttended: (attended: boolean) => void;
}

export function AppointmentCard({ appointment, onConfirm, onAttended }: AppointmentCardProps) {
  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getStatusBadge = () => {
    if (appointment.attended === true) {
      return <Badge className="bg-success">Compareceu</Badge>;
    }
    if (appointment.attended === false) {
      return <Badge variant="destructive">Não compareceu</Badge>;
    }
    if (appointment.confirmed) {
      return <Badge className="bg-info">Confirmado</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <div className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-primary text-white text-sm">
              {getInitials(appointment.lead.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{appointment.lead.full_name}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {appointment.scheduled_time.slice(0, 5)}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {appointment.lead.phone}
              </span>
            </div>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {appointment.notes && (
        <p className="mt-2 text-sm text-muted-foreground pl-13">
          {appointment.notes}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {appointment.agent.full_name}
        </div>

        {appointment.attended === null && (
          <div className="flex items-center gap-2">
            {!appointment.confirmed && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={onConfirm}
                className="text-xs"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Confirmar
              </Button>
            )}
            {appointment.confirmed && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAttended(false)}
                  className="text-xs text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3 w-3 mr-1" />
                  Falta
                </Button>
                <Button 
                  size="sm"
                  onClick={() => onAttended(true)}
                  className="text-xs bg-success hover:bg-success/90"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Compareceu
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
