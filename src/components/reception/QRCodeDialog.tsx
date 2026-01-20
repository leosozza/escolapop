import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  lead: {
    full_name: string;
    phone: string;
  } | null;
  agent: {
    full_name: string;
  } | null;
}

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
}

export function QRCodeDialog({ open, onOpenChange, appointment }: QRCodeDialogProps) {
  if (!appointment) return null;

  const qrValue = JSON.stringify({
    type: 'saf-checkin',
    appointmentId: appointment.id,
  });

  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `checkin-${appointment.lead?.full_name.replace(/\s+/g, '-')}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code para Check-in</DialogTitle>
          <DialogDescription>
            Apresente este QR code na recepção para fazer check-in
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* QR Code */}
          <div className="p-6 bg-white rounded-2xl shadow-inner">
            <QRCodeSVG
              id="qr-code-svg"
              value={qrValue}
              size={200}
              level="H"
              includeMargin
              className="rounded-lg"
            />
          </div>

          {/* Appointment Details */}
          <div className="w-full space-y-3 text-sm">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="text-muted-foreground text-xs">Nome</p>
                <p className="font-medium text-foreground">
                  {appointment.lead?.full_name || 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(appointment.scheduled_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-muted-foreground text-xs">Horário</p>
                  <p className="font-medium text-foreground">
                    {appointment.scheduled_time.slice(0, 5)}
                  </p>
                </div>
              </div>
            </div>

            {appointment.agent && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Atendente</p>
                  <p className="font-medium text-foreground">
                    {appointment.agent.full_name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Download Button */}
          <Button variant="outline" className="w-full" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Baixar QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
