/**
 * "%text%" for ILIKE, the characters % _ \ typed by the user are matched literally.
 * Returns undefined when there is nothing to search for.
 */
export const toLikePattern = (search?: string) => {
  const text = search?.trim();

  return text ? `%${text.replace(/[\\%_]/g, '\\$&')}%` : undefined;
};
