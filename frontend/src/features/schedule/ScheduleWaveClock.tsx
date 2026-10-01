import { useId } from 'react';

const WATER_PATH = 'M-420 76 Q-367.5 62 -315 76 T-210 76 T-105 76 T0 76 T105 76 T210 76 T315 76 T420 76 T525 76 T630 76 T735 76 T840 76 T945 76 T1050 76 T1155 76 T1260 76 L1260 160 L-420 160 Z';

// Keep complete white glyphs underneath the water, rather than clipping CSS text backgrounds.
export function ScheduleWaveClock({ hour, minute }: { hour: number; minute: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `tv-clock-mask-${id}`;
  const waterId = `tv-clock-water-${id}`;
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return (
    <svg className="schedule-wave-clock" viewBox="0 0 460 118" role="img" aria-label={time}>
      <defs aria-hidden="true">
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="-40" width="460" height="200">
          <text className="schedule-wave-clock__digits" x="230" y="108" textAnchor="middle" fill="white">{time}</text>
        </mask>
        <linearGradient id={waterId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="schedule-wave-clock__water-top" />
          <stop offset="1" className="schedule-wave-clock__water-bottom" />
        </linearGradient>
      </defs>
      <text className="schedule-wave-clock__digits schedule-wave-clock__base" x="230" y="108" textAnchor="middle" fill="white" aria-hidden="true">{time}</text>
      <g mask={`url(#${maskId})`} aria-hidden="true">
        <path className="schedule-wave-clock__wave schedule-wave-clock__wave--back" d={WATER_PATH} />
        <path className="schedule-wave-clock__wave schedule-wave-clock__wave--front" d={WATER_PATH} fill={`url(#${waterId})`} />
      </g>
    </svg>
  );
}
