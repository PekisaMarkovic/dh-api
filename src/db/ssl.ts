/**
 * Should the connection to the database be encrypted (sslmode=require)?
 *
 * - DB_SSL=true / false decides, when it is set
 * - otherwise: on everywhere except locally (ENVIROMENT=local or not set),
 *   hosted databases like Neon accept only encrypted connections
 */
export const useDatabaseSsl = (get: (key: string) => string | undefined) => {
  const explicit = get('DB_SSL')?.trim().toLowerCase();

  if (explicit === 'true') return true;
  if (explicit === 'false') return false;

  const environment = get('ENVIROMENT')?.trim().toLowerCase();

  return !!environment && environment !== 'local';
};
