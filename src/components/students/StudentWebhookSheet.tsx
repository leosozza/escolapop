import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-students`;

const PARAMETERS = [
  { name: "full_name", aliases: ["client_name", "nome", "name"], description: "Nome do Aluno", required: true },
  { name: "phone", aliases: ["telefone", "celular", "whatsapp"], description: "Telefone", required: true },
  { name: "email", aliases: ["e-mail"], description: "Email", required: false },
  { name: "age", aliases: ["idade", "student_age"], description: "Idade", required: false },
  { name: "course", aliases: ["curso", "course_name"], description: "Nome do Curso", required: false },
  { name: "class_name", aliases: ["turma", "class"], description: "Nome da Turma", required: false },
  { name: "enrollment_type", aliases: ["tipo_matricula", "tipo"], description: "Tipo de Matrícula", required: false },
  { name: "referral_code", aliases: ["codigo_agente", "agent_code"], description: "Código do Agente", required: false },
  { name: "influencer", aliases: ["influenciador", "influencer_name"], description: "Influenciador", required: false },
];

export function StudentWebhookSheet() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado!", description: "URL copiada para a área de transferência" });
    setTimeout(() => setCopied(false), 2000);
  };

  const exampleGET = `${WEBHOOK_URL}?full_name=João%20Silva&phone=11999998888&course=Passarela`;
  const examplePOST = {
    full_name: "João Silva",
    phone: "11999998888",
    email: "joao@email.com",
    age: 18,
    course: "Passarela",
    enrollment_type: "maxfama",
    referral_code: "AG001"
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plug className="h-4 w-4" />
          Webhook
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Webhook de Matrículas
          </SheetTitle>
          <SheetDescription>
            Endpoint para receber matrículas de sistemas externos (Bitrix, RD Station, etc.)
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6 pr-4">
            {/* URL Section */}
            <div className="space-y-2">
              <h4 className="font-medium">URL do Webhook</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted p-3 rounded text-xs break-all">
                  {WEBHOOK_URL}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(WEBHOOK_URL)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Aceita requisições GET e POST. Não requer autenticação.
              </p>
            </div>

            {/* Parameters Table */}
            <div className="space-y-2">
              <h4 className="font-medium">Parâmetros Aceitos</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Parâmetro</th>
                      <th className="text-left p-2 font-medium">Aliases</th>
                      <th className="text-left p-2 font-medium">Obrigatório</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PARAMETERS.map((param) => (
                      <tr key={param.name} className="border-t">
                        <td className="p-2">
                          <code className="text-xs bg-muted px-1 rounded">{param.name}</code>
                          <p className="text-xs text-muted-foreground">{param.description}</p>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {param.aliases.map((alias) => (
                              <Badge key={alias} variant="outline" className="text-xs">
                                {alias}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          {param.required ? (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                              Sim
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Não</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Examples */}
            <div className="space-y-2">
              <h4 className="font-medium">Exemplos de Uso</h4>
              <Tabs defaultValue="get">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="get">GET</TabsTrigger>
                  <TabsTrigger value="post">POST</TabsTrigger>
                </TabsList>
                <TabsContent value="get" className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Envie os parâmetros via query string:
                  </p>
                  <div className="relative">
                    <code className="block bg-muted p-3 rounded text-xs break-all">
                      {exampleGET}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-7 w-7"
                      onClick={() => copyToClipboard(exampleGET)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="post" className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Envie os parâmetros via JSON no body:
                  </p>
                  <div className="relative">
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(examplePOST, null, 2)}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-7 w-7"
                      onClick={() => copyToClipboard(JSON.stringify(examplePOST, null, 2))}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Response Format */}
            <div className="space-y-2">
              <h4 className="font-medium">Resposta</h4>
              <div className="space-y-2">
                <div className="border rounded-lg p-3">
                  <p className="text-sm font-medium text-green-600 mb-1">✓ Sucesso (200)</p>
                  <pre className="text-xs bg-muted p-2 rounded">
{`{
  "success": true,
  "message": "Matrícula criada com sucesso",
  "data": {
    "lead_id": "uuid",
    "enrollment_id": "uuid"
  }
}`}
                  </pre>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-sm font-medium text-red-600 mb-1">✗ Erro (400)</p>
                  <pre className="text-xs bg-muted p-2 rounded">
{`{
  "success": false,
  "error": "Nome e telefone são obrigatórios"
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium">Dicas de Integração</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• O telefone pode ser enviado com ou sem formatação</li>
                <li>• Se o telefone já existir, o lead será reutilizado</li>
                <li>• O tipo de matrícula aceita valores como "maxfama", "popschool", etc.</li>
                <li>• O curso será buscado pelo nome (correspondência parcial)</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
