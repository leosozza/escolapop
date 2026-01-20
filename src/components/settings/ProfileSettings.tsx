import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, User, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/users/RoleBadge';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const { profile, roles, user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
    },
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Perfil atualizado!',
        description: 'Suas informações foram salvas.',
      });
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar perfil',
        description: (error as Error).message || 'Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Meu Perfil
          </CardTitle>
          <CardDescription>
            Atualize suas informações de perfil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-6 pb-6 border-b">
            <Avatar className="h-20 w-20 ring-4 ring-primary/20">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-primary text-white text-xl">
                {profile?.full_name ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold">{profile?.full_name}</h3>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {roles.map((role) => (
                  <RoleBadge key={role} role={role} />
                ))}
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  className="bg-gradient-primary hover:opacity-90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
          <CardDescription>
            Detalhes da sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between py-3 border-b">
              <span className="text-muted-foreground">Membro desde</span>
              <span className="font-medium">
                {profile?.created_at 
                  ? new Date(profile.created_at).toLocaleDateString('pt-BR')
                  : '-'
                }
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Última atualização</span>
              <span className="font-medium">
                {profile?.updated_at 
                  ? new Date(profile.updated_at).toLocaleDateString('pt-BR')
                  : '-'
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
