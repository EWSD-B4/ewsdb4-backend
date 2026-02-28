export const ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
  COORDINATOR: 'coordinator',
  MANAGER: 'manager',
  GUEST: 'guest',
  USER: 'user',
  MODERATOR: 'moderator',
} as const;

export type Roles = (typeof ROLES)[keyof typeof ROLES];
