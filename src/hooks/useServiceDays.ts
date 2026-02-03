import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatServiceDay } from '@/lib/commercial-schedule-config';

export interface ServiceDay {
  id: string;
  service_date: string;
  weekday_name: string;
  is_active: boolean;
  max_per_hour: number;
  created_at: string;
  created_by: string | null;
  // Computed field for display
  label: string;
}

export function useServiceDays() {
  const [serviceDays, setServiceDays] = useState<ServiceDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchServiceDays = async () => {
    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('service_days')
        .select('*')
        .eq('is_active', true)
        .gte('service_date', today)
        .order('service_date', { ascending: true });

      if (error) throw error;

      const formattedDays = (data || []).map(day => ({
        ...day,
        label: formatServiceDay(new Date(day.service_date + 'T12:00:00')),
      }));

      setServiceDays(formattedDays);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching service days:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceDays();
  }, []);

  return {
    serviceDays,
    isLoading,
    error,
    refetch: fetchServiceDays,
  };
}
