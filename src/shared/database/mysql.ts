import mysql from 'mysql2/promise';
import config from '@/config';
import logger from '@/shared/logger';

class MySQLDatabase {
  private static instance: MySQLDatabase;
  private pool: mysql.Pool | null = null;

  private constructor() {}

  public static getInstance(): MySQLDatabase {
    if (!MySQLDatabase.instance) {
      MySQLDatabase.instance = new MySQLDatabase();
    }
    return MySQLDatabase.instance;
  }

  public async connect(): Promise<void> {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name,
        connectionLimit: config.database.connectionLimit,
        waitForConnections: true,
        queueLimit: 0,
      });

      const connection = await this.pool.getConnection();
      logger.info('MySQL database connected successfully');
      connection.release();
    } catch (error) {
      logger.error('Failed to connect to MySQL database:', error);
      throw error;
    }
  }

  public getPool(): mysql.Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }
    return this.pool;
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('MySQL database disconnected');
    }
  }

  public async query<T>(sql: string, params?: any[]): Promise<T> {
    const pool = this.getPool();
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  }

  public async transaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    const pool = this.getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default MySQLDatabase.getInstance();
