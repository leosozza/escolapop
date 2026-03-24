import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WaveSurferPlayerProps {
  src: string;
  isOutbound: boolean;
}

export function WaveSurferPlayer({ src, isOutbound }: WaveSurferPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const initWaveSurfer = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      const WaveSurfer = (await import('wavesurfer.js')).default;

      if (wsRef.current) {
        wsRef.current.destroy();
      }

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: isOutbound ? 'rgba(255,255,255,0.4)' : 'rgba(100,100,100,0.4)',
        progressColor: isOutbound ? 'rgba(255,255,255,0.9)' : 'hsl(var(--primary))',
        cursorWidth: 0,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 32,
        normalize: true,
        url: src,
      });

      ws.on('ready', () => {
        setDuration(ws.getDuration());
        setReady(true);
      });

      ws.on('audioprocess', () => {
        setCurrentTime(ws.getCurrentTime());
      });

      ws.on('seeking', () => {
        setCurrentTime(ws.getCurrentTime());
      });

      ws.on('finish', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      ws.on('error', () => {
        setError(true);
      });

      wsRef.current = ws;
    } catch {
      setError(true);
    }
  }, [src, isOutbound]);

  useEffect(() => {
    initWaveSurfer();
    return () => {
      wsRef.current?.destroy();
    };
  }, [initWaveSurfer]);

  const togglePlay = () => {
    if (!wsRef.current || !ready) return;
    wsRef.current.playPause();
    setIsPlaying(!isPlaying);
  };

  const formatSec = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Fallback to native audio if wavesurfer fails
  if (error) {
    return (
      <div className="min-w-[200px]">
        <audio controls src={src} preload="metadata" className="w-full h-8" style={{ filter: isOutbound ? 'invert(1)' : 'none' }} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 rounded-full shrink-0',
          isOutbound ? 'text-white hover:bg-green-700' : 'hover:bg-muted-foreground/20'
        )}
        onClick={togglePlay}
        disabled={!ready}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 flex flex-col gap-1">
        <div ref={containerRef} className="w-full" />
        <span className={cn('text-[10px]', isOutbound ? 'text-green-200' : 'text-muted-foreground')}>
          {isPlaying ? formatSec(currentTime) : formatSec(duration)}
        </span>
      </div>
    </div>
  );
}
