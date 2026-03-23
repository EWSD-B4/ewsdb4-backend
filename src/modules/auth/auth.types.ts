export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  name: string;
  password: string;
  roleId?: number;
  facultyId?: number;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    role_id: number;
    faculty: string;
  };
  token: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  facultyId: number;
}

export interface UpdatePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface ForgetPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  token: string;
  newPassword: string;
}
