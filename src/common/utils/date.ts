export function formatDateYearMonthDay(input: Date | string | number): string {
  let date: Date;

  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string' || typeof input === 'number') {
    date = new Date(input);
  } else {
    throw new Error('Invalid input type. Expected Date, string, or number.');
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
