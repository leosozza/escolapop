import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface DuplicateInfo {
  type: 'phone' | 'code';
  existingName: string;
  value: string;
}

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateInfo: DuplicateInfo | null;
  onConfirm: () => void;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicateInfo,
  onConfirm,
}: DuplicateWarningDialogProps) {
  if (!duplicateInfo) return null;

  const typeLabel = duplicateInfo.type === 'phone' ? 'Telefone' : 'Código';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            {typeLabel} já cadastrado na plataforma
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Já existe um cadastro com este {typeLabel.toLowerCase()}:
            </p>
            <div className="bg-muted p-3 rounded-md">
              <p className="font-medium">{duplicateInfo.existingName}</p>
              <p className="text-sm text-muted-foreground">
                {typeLabel}: {duplicateInfo.value}
              </p>
            </div>
            <p className="font-medium mt-4">
              Deseja criar um aluno novo mesmo assim?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Não, cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-warning hover:bg-warning/90"
          >
            Sim, criar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
