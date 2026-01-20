import { useState } from 'react';
import { Copy, Check, Link2, Code, FileJson, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-leads`;

const webhookParams = [
  { name: 'client_name', aliases: ['full_name', 'nome'], field: 'Nome completo', required: true },
  { name: 'phone', aliases: ['telefone', 'celular', 'whatsapp'], field: 'Telefone', required: true },
  { name: 'email', aliases: [], field: 'E-mail', required: false },
  { name: 'modelo', aliases: ['campanha', 'campaign'], field: 'Campanha', required: false },
  { name: 'event_date', aliases: ['data_evento'], field: 'Data do evento', required: false },
  { name: 'Hora', aliases: ['event_time', 'horario'], field: 'Horário', required: false },
  { name: 'Telemarketing', aliases: ['telemarketing', 'tm'], field: 'Operador TM', required: false },
  { name: 'scouter', aliases: ['Scouter', 'captador'], field: 'Scouter', required: false },
  { name: 'local', aliases: ['Local', 'localização', 'location'], field: 'Localização', required: false },
  { name: 'projeto', aliases: ['Projeto', 'agencia', 'agency'], field: 'Projeto/Agência', required: false },
  { name: 'lead_id', aliases: ['external_id', 'id_externo'], field: 'ID externo', required: false },
];

const getExampleUrl = () => {
  const params = new URLSearchParams({
    client_name: 'João Silva',
    phone: '11999999999',
    email: 'joao@email.com',
    modelo: 'Campanha Instagram',
    scouter: 'Maria',
    local: 'Shopping Ibirapuera',
  });
  return `${WEBHOOK_URL}?${params.toString()}`;
};

const getExampleJson = () => JSON.stringify({
  client_name: 'João Silva',
  phone: '11999999999',
  email: 'joao@email.com',
  modelo: 'Campanha Instagram',
  scouter: 'Maria',
  local: 'Shopping Ibirapuera',
  custom_fields: {
    guardian_name: 'Ana Silva',
    age: 18,
  },
}, null, 2);

export function WebhookSettings() {
  const [copied, setCopied] = useState<string | null>(null);

  const { data: recentLeads } = useQuery({
    queryKey: ['recent-webhook-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone, created_at, source:lead_sources(name)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => copyToClipboard(text, id)}
    >
      {copied === id ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Webhook de Leads
          </CardTitle>
          <CardDescription>
            Receba leads automaticamente de sistemas externos (Bitrix, RD Station, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">URL do Endpoint</label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm">
              <code className="flex-1 break-all">{WEBHOOK_URL}</code>
              <CopyButton text={WEBHOOK_URL} id="webhook-url" />
            </div>
          </div>

          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              GET
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              POST
            </Badge>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este endpoint é público. Para maior segurança, considere implementar uma API Key no futuro.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Parameters */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Parâmetros Aceitos
          </CardTitle>
          <CardDescription>
            Mapeamento de campos externos para o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parâmetro</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead>Campo no Sistema</TableHead>
                <TableHead className="text-center">Obrigatório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhookParams.map((param) => (
                <TableRow key={param.name}>
                  <TableCell className="font-mono text-sm">{param.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {param.aliases.length > 0 ? param.aliases.join(', ') : '-'}
                  </TableCell>
                  <TableCell>{param.field}</TableCell>
                  <TableCell className="text-center">
                    {param.required ? (
                      <Badge variant="destructive" className="text-xs">Sim</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Examples */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Exemplos de Uso
          </CardTitle>
          <CardDescription>
            Copie e adapte para sua integração
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="get" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="get">GET (Query String)</TabsTrigger>
              <TabsTrigger value="post">POST (JSON)</TabsTrigger>
            </TabsList>

            <TabsContent value="get">
              <div className="relative">
                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                  <code className="break-all whitespace-pre-wrap">{getExampleUrl()}</code>
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton text={getExampleUrl()} id="example-get" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="post">
              <div className="relative">
                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                  <code>{getExampleJson()}</code>
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton text={getExampleJson()} id="example-post" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Recent Leads */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Últimos Leads Recebidos
          </CardTitle>
          <CardDescription>
            Histórico recente de leads cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLeads && recentLeads.length > 0 ? (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{lead.full_name}</p>
                    <p className="text-sm text-muted-foreground">{lead.phone}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      {lead.source?.name || 'Sem fonte'}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhum lead recebido recentemente
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
