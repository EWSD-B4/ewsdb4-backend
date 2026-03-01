export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  role_id: number;
  faculty: string;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  password: string;
  role_id: number;
  faculty_id?: number;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  last_login?: Date;
}
