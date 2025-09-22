import { format } from 'date-fns';

export function formatDateTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return format(new Date(date), 'dd/MM/yyyy, HH:mm:ss');
}