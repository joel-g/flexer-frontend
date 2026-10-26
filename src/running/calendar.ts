export function planToday(zone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function dayValue(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a valid local date.');
  const [year, month, day] = value.split('-').map(Number); const date = new Date(0); date.setUTCFullYear(year, month - 1, day);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Enter a valid local date.');
  return date.getTime() / 86400000;
}
export function mondayOf(value: string): string {
  const day = dayValue(value); const weekday = (day + 3) % 7;
  return new Date((day - (weekday + 7) % 7) * 86400000).toISOString().slice(0, 10);
}
