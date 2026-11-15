/** Clinic contact details and opening hours (Tbilisi time), shown on the contact page and in the footer. */
export const CLINIC = {
  name: 'Umbrella Medical Center',
  address: '12 Shota Rustaveli Avenue',
  city: '0108 Tbilisi, Georgia',
  phone: '+995 32 255 12 12',
  phoneHref: '+995322551212',
  emergency: '112',
  mapUrl: 'https://www.openstreetmap.org/export/embed.html?bbox=44.790%2C41.693%2C44.808%2C41.703&layer=mapnik&marker=41.6980%2C44.7990',
  mapLink: 'https://www.openstreetmap.org/?mlat=41.6980&mlon=44.7990#map=17/41.6980/44.7990'
};

/** Opening hours by weekday (0 = Sunday), in minutes after midnight; null = closed. */
// The clinic is open around the clock, every day of the week (doctors' visit hours are set per doctor).
const ALL_DAY = { open: 0, close: 24 * 60 };
export const OPENING_HOURS: ({ open: number; close: number } | null)[] = [ALL_DAY, ALL_DAY, ALL_DAY, ALL_DAY, ALL_DAY, ALL_DAY, ALL_DAY];

/** True when every day is 00:00-24:00, so the site shows "Open 24/7" instead of times. */
export const ALWAYS_OPEN = OPENING_HOURS.every(h => !!h && h.open === 0 && h.close === 24 * 60);

export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Whether the clinic is open right now (Tbilisi time), and until or from when. */
export function openStatus(now = new Date()): { open: boolean; until?: string; next?: { day: number; time: string } } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));

  const today = OPENING_HOURS[day];
  if (today && minutes >= today.open && minutes < today.close) return { open: true, until: hhmm(today.close) };
  if (today && minutes < today.open) return { open: false, next: { day, time: hhmm(today.open) } };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7, hours = OPENING_HOURS[d];
    if (hours) return { open: false, next: { day: d, time: hhmm(hours.open) } };
  }
  return { open: false };
}
