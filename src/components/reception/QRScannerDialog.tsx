import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, Camera, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (appointmentId: string) => void;
}

export function QRScannerDialog({ open, onOpenChange, onScan }: QRScannerDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [open]);

  const startScanner = async () => {
    if (!containerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // Create scanner instance
      const scanner = new Html5Qrcode('qr-scanner-container');
      scannerRef.current = scanner;

      // Start scanning
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            if (data.type === 'saf-checkin' && data.appointmentId) {
              stopScanner();
              onScan(data.appointmentId);
            }
          } catch {
            // Not a valid QR code, ignore
          }
        },
        () => {
          // Error callback - ignore scan errors
        }
      );

      setIsLoading(false);
      setHasPermission(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setIsLoading(false);
      
      if (String(err).includes('Permission')) {
        setHasPermission(false);
        setError('Permissão de câmera negada. Por favor, permita o acesso à câmera.');
      } else {
        setError('Não foi possível iniciar a câmera. Verifique se seu dispositivo tem câmera.');
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
  };

  const handleClose = () => {
    stopScanner();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Escanear QR Code
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR code do agendamento
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div 
            ref={containerRef}
            className="relative w-full aspect-square max-w-[300px] bg-muted rounded-lg overflow-hidden"
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <div id="qr-scanner-container" className="w-full h-full" />
          </div>

          {!hasPermission && (
            <Button onClick={startScanner} className="bg-gradient-primary">
              <Camera className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          )}

          <p className="text-sm text-muted-foreground text-center">
            Posicione o QR code dentro da área de escaneamento
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
