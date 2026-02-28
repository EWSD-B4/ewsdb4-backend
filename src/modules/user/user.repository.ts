import { RowDataPacket } from 'mysql2';
import database from '@/shared/database/mysql';
import { User, CreateUserDTO, UpdateUserDTO } from './user.types';

class UserRepository {
  private tableName = 'users';

  async findAll(): Promise<User[]> {
    const query = `SELECT ${this.tableName}.id,
      ${this.tableName}.email,
      CONCAT_WS(' ', ${this.tableName}.first_name, ${this.tableName}.last_name) as name,
      ${this.tableName}.created_at as createdAt,
      ${this.tableName}.updated_at as updatedAt,
      roles.role_code as role
      FROM ${this.tableName}
      JOIN roles ON ${this.tableName}.role_id = roles.id`;
    const users = await database.query<RowDataPacket[]>(query);
    return users as User[];
  }

  async findById(id: string): Promise<User | null> {
    const query = `SELECT ${this.tableName}.id,
      ${this.tableName}.email,
      CONCAT_WS(' ', ${this.tableName}.first_name, ${this.tableName}.last_name) as name,
      ${this.tableName}.created_at as createdAt,
      ${this.tableName}.updated_at as updatedAt,
      roles.role_code as role
      FROM ${this.tableName}
      JOIN roles ON ${this.tableName}.role_id = roles.id
      WHERE ${this.tableName}.id = ?`;
    const users = await database.query<RowDataPacket[]>(query, [id]);
    return users.length > 0 ? (users[0] as User) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `SELECT ${this.tableName}.id,
      ${this.tableName}.email,
      CONCAT_WS(' ', ${this.tableName}.first_name, ${this.tableName}.last_name) as name,
      ${this.tableName}.created_at as createdAt,
      ${this.tableName}.updated_at as updatedAt,
      roles.role_code as role
      FROM ${this.tableName}
      JOIN roles ON ${this.tableName}.role_id = roles.id
      WHERE ${this.tableName}.email = ?`;
    const users = await database.query<RowDataPacket[]>(query, [email]);
    return users.length > 0 ? (users[0] as User) : null;
  }

  async findByEmailWithPassword(email: string): Promise<(User & { password: string }) | null> {
    const query = `SELECT ${this.tableName}.id,
      ${this.tableName}.email,
      CONCAT_WS(' ', ${this.tableName}.first_name, ${this.tableName}.last_name) as name,
      ${this.tableName}.password_hash as password,
      ${this.tableName}.created_at as createdAt,
      ${this.tableName}.updated_at as updatedAt,
      roles.role_code as role
      FROM ${this.tableName}
      JOIN roles ON ${this.tableName}.role_id = roles.id
      WHERE ${this.tableName}.email = ?`;
    const users = await database.query<RowDataPacket[]>(query, [email]);
    return users.length > 0 ? (users[0] as User & { password: string }) : null;
  }

  async create(userData: CreateUserDTO): Promise<User> {
    const query = `INSERT INTO ${this.tableName} (email, first_name, last_name, password_hash, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`;
    const firstName = userData.name?.trim() || null;
    const result = await database.query<any>(query, [
      userData.email,
      firstName,
      null,
      userData.password,
      userData.role_id,
    ]);

    const newUser = await this.findById(result.insertId);
    if (!newUser) {
      throw new Error('Failed to create user');
    }
    return newUser;
  }

  async update(id: string, userData: UpdateUserDTO): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (userData.name) {
      fields.push('first_name = ?', 'last_name = ?');
      values.push(userData.name, null);
    }
    if (userData.email) {
      fields.push('email = ?');
      values.push(userData.email);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `UPDATE ${this.tableName} SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    await database.query(query, values);

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await database.query<any>(query, [id]);
    return result.affectedRows > 0;
  }
}

export default new UserRepository();
