import { User, Plug } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { WebhookSettings } from '@/components/settings/WebhookSettings';

export default function Settings() {
  const { hasRole } = useAuth();
  const canAccessIntegrations = hasRole('admin') || hasRole('gestor');

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie seu perfil e integrações do sistema
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Meu Perfil
          </TabsTrigger>
          {canAccessIntegrations && (
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-4 w-4" />
              Integrações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>

        {canAccessIntegrations && (
          <TabsContent value="integrations">
            <WebhookSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
