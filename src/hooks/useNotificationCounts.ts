import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationCounts {
  crm: number;
  appointments: number;
  overdue: number;
  reception: number;
}

export function useNotificationCounts() {
  const [counts, setCounts] = useState<NotificationCounts>({
    crm: 0,
    appointments: 0,
    overdue: 0,
    reception: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchCounts = async () => {
    try {
      // Fetch new leads (created in last 24h with status 'lead')
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      const { count: crmCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'lead')
        .gte('created_at', twentyFourHoursAgo.toISOString());

      // Fetch today's appointments that are not attended yet
      const today = new Date().toISOString().split('T')[0];
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('scheduled_date', today)
        .eq('attended', false);

      // Fetch overdue payments
      const { count: overdueCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'atrasado');

      // Fetch pending check-ins (today's appointments not yet checked in)
      const { count: receptionCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('scheduled_date', today)
        .eq('confirmed', true)
        .is('checked_in_at', null);

      setCounts({
        crm: crmCount || 0,
        appointments: appointmentsCount || 0,
        overdue: overdueCount || 0,
        reception: receptionCount || 0,
      });
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();

    // Set up realtime subscriptions
    const leadsChannel = supabase
      .channel('leads-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => fetchCounts()
      )
      .subscribe();

    const appointmentsChannel = supabase
      .channel('appointments-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchCounts()
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel('payments-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => fetchCounts()
      )
      .subscribe();

    // Refresh counts every 5 minutes
    const interval = setInterval(fetchCounts, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(paymentsChannel);
      clearInterval(interval);
    };
  }, []);

  return { counts, isLoading, refetch: fetchCounts };
}
