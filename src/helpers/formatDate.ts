export const formatCurrentDate = (): string => {
    const currentDate = new Date();
    const options = { year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const };
    const formattedDate = new Intl.DateTimeFormat('es-ES', options).format(
      currentDate,
    );

    return formattedDate;
}