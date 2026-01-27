import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Award, Download, Eye, Edit2, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CertificateData {
  studentName: string;
  courseName: string;
  completionDate: string;
}

interface CertificateGeneratorProps {
  initialData?: CertificateData;
  onSave?: (data: CertificateData) => void;
}

export function CertificateGenerator({ initialData, onSave }: CertificateGeneratorProps) {
  const [isEditing, setIsEditing] = useState(!initialData);
  const [data, setData] = useState<CertificateData>(
    initialData || {
      studentName: '',
      courseName: '',
      completionDate: format(new Date(), 'yyyy-MM-dd'),
    }
  );
  const certificateRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    if (!data.studentName || !data.courseName || !data.completionDate) {
      return;
    }
    setIsEditing(false);
    onSave?.(data);
  };

  const handleDownload = async () => {
    if (!certificateRef.current) return;

    // Use html2canvas dynamically (if needed, can be added as dependency)
    // For now, we'll use native print functionality
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Certificado - ${data.studentName}</title>
            <style>
              body {
                margin: 0;
                padding: 40px;
                font-family: 'Georgia', serif;
                background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              .certificate {
                width: 900px;
                padding: 60px;
                background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
                border: 8px double #1a1a2e;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                text-align: center;
                position: relative;
              }
              .certificate::before {
                content: '';
                position: absolute;
                top: 20px;
                left: 20px;
                right: 20px;
                bottom: 20px;
                border: 2px solid #d4af37;
                pointer-events: none;
              }
              .title {
                font-size: 48px;
                font-weight: bold;
                color: #1a1a2e;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 8px;
              }
              .subtitle {
                font-size: 20px;
                color: #666;
                margin-bottom: 40px;
                font-style: italic;
              }
              .certify-text {
                font-size: 18px;
                color: #333;
                margin-bottom: 20px;
              }
              .student-name {
                font-size: 36px;
                font-weight: bold;
                color: #1a1a2e;
                margin: 20px 0;
                border-bottom: 2px solid #d4af37;
                display: inline-block;
                padding-bottom: 10px;
              }
              .course-text {
                font-size: 18px;
                color: #333;
                margin: 20px 0;
              }
              .course-name {
                font-size: 28px;
                font-weight: bold;
                color: #2c3e50;
                margin: 10px 0;
              }
              .date-text {
                font-size: 16px;
                color: #666;
                margin-top: 40px;
              }
              .signature-area {
                display: flex;
                justify-content: space-around;
                margin-top: 60px;
                padding-top: 40px;
              }
              .signature {
                text-align: center;
              }
              .signature-line {
                width: 200px;
                border-top: 1px solid #333;
                margin-bottom: 10px;
              }
              .signature-title {
                font-size: 14px;
                color: #666;
              }
              .award-icon {
                font-size: 60px;
                margin-bottom: 20px;
              }
              @media print {
                body { background: white; padding: 0; }
                .certificate { box-shadow: none; }
              }
            </style>
          </head>
          <body>
            <div class="certificate">
              <div class="award-icon">🏆</div>
              <h1 class="title">Certificado</h1>
              <p class="subtitle">de Conclusão</p>
              <p class="certify-text">Certificamos que</p>
              <p class="student-name">${data.studentName}</p>
              <p class="course-text">concluiu com êxito o curso de</p>
              <p class="course-name">${data.courseName}</p>
              <p class="date-text">
                Concluído em ${format(new Date(data.completionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <div class="signature-area">
                <div class="signature">
                  <div class="signature-line"></div>
                  <p class="signature-title">Diretor(a)</p>
                </div>
                <div class="signature">
                  <div class="signature-line"></div>
                  <p class="signature-title">Coordenador(a)</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Edit Form */}
      {isEditing ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">Nome do Aluno</Label>
              <Input
                id="studentName"
                value={data.studentName}
                onChange={(e) => setData({ ...data, studentName: e.target.value })}
                placeholder="Nome completo do aluno"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseName">Curso Concluído</Label>
              <Input
                id="courseName"
                value={data.courseName}
                onChange={(e) => setData({ ...data, courseName: e.target.value })}
                placeholder="Nome do curso"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="completionDate">Data de Conclusão</Label>
              <Input
                id="completionDate"
                type="date"
                value={data.completionDate}
                onChange={(e) => setData({ ...data, completionDate: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" />
                Salvar
              </Button>
              {initialData && (
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
            <Edit2 className="h-4 w-4" />
            Editar
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar Certificado
          </Button>
        </div>
      )}

      {/* Certificate Preview */}
      <div
        ref={certificateRef}
        className="relative bg-gradient-to-br from-background to-muted border-8 border-double border-primary/30 p-8 md:p-12 text-center shadow-2xl"
      >
        {/* Inner Border */}
        <div className="absolute inset-4 border-2 border-primary/20 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 space-y-6">
          <Award className="h-16 w-16 mx-auto text-primary" />

          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-[0.3em] text-foreground uppercase">
              Certificado
            </h1>
            <p className="text-lg text-muted-foreground italic mt-2">de Conclusão</p>
          </div>

          <Separator className="w-1/2 mx-auto" />

          <p className="text-lg text-muted-foreground">Certificamos que</p>

          <p className="text-3xl md:text-4xl font-bold text-foreground border-b-2 border-primary/30 inline-block pb-2 px-4">
            {data.studentName || 'Nome do Aluno'}
          </p>

          <p className="text-lg text-muted-foreground">concluiu com êxito o curso de</p>

          <p className="text-2xl md:text-3xl font-semibold text-primary">
            {data.courseName || 'Nome do Curso'}
          </p>

          <p className="text-muted-foreground">
            Concluído em{' '}
            <span className="font-medium text-foreground">
              {data.completionDate
                ? format(new Date(data.completionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                : 'Data de conclusão'}
            </span>
          </p>

          {/* Signatures */}
          <div className="flex justify-around pt-8 mt-8">
            <div className="text-center">
              <div className="w-40 border-t border-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Diretor(a)</p>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Coordenador(a)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
