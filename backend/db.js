import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readSecret } from './config.js';

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: readSecret('MYSQL_PASSWORD'),
  database: process.env.MYSQL_DATABASE || 'finance_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
