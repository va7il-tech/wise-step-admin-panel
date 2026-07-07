import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Circular countdown synced to an absolute deadline (epoch ms). */
export function CountdownRing({
  endsAt,
  totalSeconds,
  large,
}: {
  endsAt: number;
  totalSeconds: number;
  large?: boolean;
}) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, endsAt - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, endsAt - Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [endsAt]);

  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = Math.min(1, remainingMs / (totalSeconds * 1000));
  const size = large ? 88 : 48;
  const stroke = large ? 7 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const urgent = seconds <= 5;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="timer">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={large ? 'stroke-white/15' : 'stroke-mist-200'}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn(
            'transition-[stroke-dashoffset] duration-100 ease-linear',
            urgent ? 'stroke-error-500' : 'stroke-teal-500',
          )}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center font-bold tabular-nums',
          large ? 'text-2xl text-white' : 'text-sm text-navy-700',
          urgent && 'text-error-500',
        )}
      >
        {seconds}
      </span>
    </div>
  );
}
