export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  COORDINATOR: 'COORDINATOR',
  STUDENT: 'STUDENT',
  GUEST: 'GUEST',
} as const;

export type Roles = (typeof ROLES)[keyof typeof ROLES];
