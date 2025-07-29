import { Pool } from 'pg';

const pool = new Pool({
  host: '***',
  port: 5432,
  user: 'admin',
  password: '*****',
  database: 'mvp'
});

export default pool;
