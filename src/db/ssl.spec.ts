import { useDatabaseSsl } from '@/db/ssl';

describe('useDatabaseSsl', () => {
  const env = (values: Record<string, string | undefined>) => (key: string) =>
    values[key];

  it('should follow DB_SSL when it is set, whatever the environment is', () => {
    expect(useDatabaseSsl(env({ DB_SSL: 'true', ENVIROMENT: 'local' }))).toBe(
      true,
    );
    expect(
      useDatabaseSsl(env({ DB_SSL: 'false', ENVIROMENT: 'production' })),
    ).toBe(false);
    expect(useDatabaseSsl(env({ DB_SSL: ' TRUE ' }))).toBe(true);
  });

  it.each(['production', 'staging', 'development'])(
    'should be on in the environment %s, hosted databases accept only encrypted connections',
    (ENVIROMENT) => {
      expect(useDatabaseSsl(env({ ENVIROMENT }))).toBe(true);
    },
  );

  it.each([undefined, '', 'local', ' Local '])(
    'should be off locally (%p)',
    (ENVIROMENT) => {
      expect(useDatabaseSsl(env({ ENVIROMENT }))).toBe(false);
    },
  );

  it('should ignore a DB_SSL that is not true or false', () => {
    expect(
      useDatabaseSsl(env({ DB_SSL: 'maybe', ENVIROMENT: 'production' })),
    ).toBe(true);
    expect(useDatabaseSsl(env({ DB_SSL: 'maybe', ENVIROMENT: 'local' }))).toBe(
      false,
    );
  });
});
