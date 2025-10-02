export const formatCurrentDate = (): string => {
    const currentDate = new Date();
    const options = { year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const };
    const formattedDate = new Intl.DateTimeFormat('es-ES', options).format(
      currentDate,
    );

    return formattedDate;
}

export const formatCurrentDateTime = (): number => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  return Number(`${year}${month}${day}${hour}${minute}${second}${ms}`);
};