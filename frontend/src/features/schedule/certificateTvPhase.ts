const startsAt = Date.parse('2026-11-20T00:00:00+07:00');
const endsAt = Date.parse('2026-12-01T00:00:00+07:00');
const cycleDuration = 60_000;
const scheduleDuration = 49_000;

export function certificateTvPhase(locationId: string, timestamp: number) {
  if (locationId !== '2' || timestamp < startsAt || timestamp >= endsAt) {
    return 'inactive';
  }

  return (timestamp - startsAt) % cycleDuration >= scheduleDuration ? 'poster' : 'schedule';
}
