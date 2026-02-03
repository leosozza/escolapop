import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { COMMERCIAL_HOURS, DEFAULT_MAX_PER_HOUR } from '@/lib/commercial-schedule-config';

export interface HourCount {
  hour: string;
  count: number;
  isFull: boolean;
  isWarning: boolean;
}

export function useAppointmentCounts(serviceDate: string | null, maxPerHour: number = DEFAULT_MAX_PER_HOUR) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hourCounts, setHourCounts] = useState<HourCount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!serviceDate) {
      setCounts({});
      setHourCounts([]);
      return;
    }

    const fetchCounts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('scheduled_time')
          .eq('scheduled_date', serviceDate);

        if (error) throw error;

        // Group by hour
        const grouped = (data || []).reduce((acc, apt) => {
          const hour = apt.scheduled_time.slice(0, 5); // "09:00"
          acc[hour] = (acc[hour] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setCounts(grouped);

        // Create hour counts with status
        const hours = COMMERCIAL_HOURS.map(hour => {
          const count = grouped[hour] || 0;
          return {
            hour,
            count,
            isFull: count >= maxPerHour,
            isWarning: count >= maxPerHour * 0.8 && count < maxPerHour,
          };
        });

        setHourCounts(hours);
      } catch (err) {
        console.error('Error fetching appointment counts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCounts();
  }, [serviceDate, maxPerHour]);

  return {
    counts,
    hourCounts,
    isLoading,
    maxPerHour,
  };
}
