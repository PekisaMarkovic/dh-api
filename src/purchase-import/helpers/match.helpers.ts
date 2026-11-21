/** Lowercase, no diacritics, only letters and digits split in tokens: "Coca-Cola 1,5L" -> ["coca","cola","1","5l"] */
export const toTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** 0..1, how much of the two names is shared; the order of the words does not matter */
export const nameSimilarity = (a: string, b: string): number => {
  const first = new Set(toTokens(a));
  const second = new Set(toTokens(b));

  if (!first.size || !second.size) {
    return 0;
  }

  const shared = [...first].filter((token) => second.has(token)).length;

  return shared / Math.max(first.size, second.size);
};

/** The drink that is the best match for the name, only when it is a good enough match */
export const findBestMatch = <T extends { name: string }>(
  name: string,
  drinks: T[],
  minScore = 0.6,
): T | null => {
  let best: T | null = null;
  let bestScore = 0;

  for (const drink of drinks) {
    const score = nameSimilarity(name, drink.name);

    if (score > bestScore) {
      best = drink;
      bestScore = score;
    }
  }

  return bestScore >= minScore ? best : null;
};
