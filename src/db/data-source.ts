import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { useDatabaseSsl } from './ssl';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // encrypted (sslmode=require) everywhere except locally, see useDatabaseSsl
  ssl: useDatabaseSsl((key) => process.env[key]),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});
