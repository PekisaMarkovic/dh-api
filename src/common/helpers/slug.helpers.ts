function removeDiacritics(str: string): string {
  // đ is a letter of its own, not a d with a mark, NFD would drop it
  return str
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function cleanUpString(text: string): string {
  return removeDiacritics(text)
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

function truncateString(str: string, len: number): string {
  if (str.length > len) {
    return str.substring(0, len);
  }
  return str;
}

export function slugify({
  text,
  truncate,
}: {
  text: string;
  truncate?: number;
}): string {
  return cleanUpString(truncate ? truncateString(text, truncate) : text);
}
