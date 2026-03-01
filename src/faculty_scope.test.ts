import request from 'supertest';

const prismaMock = {
  faculty: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  contribution: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
};

jest.mock('@/shared/database', () => ({
  __esModule: true,
  db: prismaMock,
  database: {
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('@/shared/cache/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('@/utils/jwt', () => ({
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
}));

import app from './app';
import { db as prisma } from '@/shared/database';
import cache from '@/shared/cache/redis';
import { verifyToken } from '@/utils/jwt';

type DecodedToken = { userId: string; email: string; role: string };

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Faculty Scope API (roles + faculty endpoints)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (cache.get as jest.Mock).mockResolvedValue('logged_in');

    (verifyToken as jest.Mock).mockImplementation((token: string): DecodedToken => {
      if (token === 'token-admin')
        return { userId: '100', email: 'admin@example.com', role: 'admin' };
      if (token === 'token-student')
        return { userId: '200', email: 'student@example.com', role: 'student' };
      if (token === 'token-coordinator') {
        return { userId: '300', email: 'coord@example.com', role: 'coordinator' };
      }
      if (token === 'token-coordinator-no-faculty') {
        return { userId: '301', email: 'coord.nofac@example.com', role: 'coordinator' };
      }
      if (token === 'token-manager')
        return { userId: '400', email: 'manager@example.com', role: 'manager' };
      throw new Error('Invalid token');
    });

    (prisma.faculty.findMany as jest.Mock).mockResolvedValue([
      { id: 1, facultyCode: 'ENG', facultyName: 'Engineering', isActive: true },
    ]);
    (prisma.faculty.count as jest.Mock).mockResolvedValue(1);
    (prisma.faculty.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.faculty.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 2,
      facultyCode: data.facultyCode,
      facultyName: data.facultyName,
      isActive: true,
    }));
    (prisma.faculty.findUnique as jest.Mock).mockImplementation(async ({ where }) => {
      const id = where?.id;
      if (id === 999) return null;
      if (id === 3) return { id: 3, facultyCode: 'LAW', facultyName: 'Law', isActive: false };
      return { id, facultyCode: 'ENG', facultyName: 'Engineering', isActive: true };
    });
    (prisma.faculty.update as jest.Mock).mockImplementation(async ({ where, data }) => ({
      id: where.id,
      facultyCode: data.facultyCode ?? 'ENG',
      facultyName: data.facultyName ?? 'Engineering',
      isActive: data.isActive ?? true,
    }));

    (prisma.user.findUnique as jest.Mock).mockImplementation(async ({ where, include }) => {
      const id = where?.id;
      if (id === 100) {
        return include?.role
          ? { id: 100, facultyId: null, role: { roleCode: 'admin' } }
          : { id: 100, facultyId: null };
      }
      if (id === 200) {
        return include?.role
          ? { id: 200, facultyId: 1, role: { roleCode: 'student' } }
          : { id: 200, facultyId: 1 };
      }
      if (id === 300) {
        return include?.role
          ? { id: 300, facultyId: 1, role: { roleCode: 'coordinator' } }
          : { id: 300, facultyId: 1 };
      }
      if (id === 301) {
        return include?.role
          ? { id: 301, facultyId: null, role: { roleCode: 'coordinator' } }
          : { id: 301, facultyId: null };
      }
      if (id === 500) {
        return include?.role
          ? { id: 500, facultyId: null, role: { roleCode: 'student' } }
          : { id: 500, facultyId: null };
      }
      return null;
    });
    (prisma.user.update as jest.Mock).mockImplementation(async ({ where, data }) => ({
      id: where.id,
      roleId: 2,
      email: 'student@example.com',
      firstName: 'Student',
      lastName: 'User',
      facultyId: data.facultyId,
      isActive: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      lastLogin: null,
    }));
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.count as jest.Mock).mockResolvedValue(0);

    (prisma.contribution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.contribution.count as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.userId) return 0;
      if (where?.status === 'selected') return 1;
      return 2;
    });
    (prisma.contribution.findFirst as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.id === 404 || Number.isNaN(where?.id)) return null;
      return {
        id: where?.id ?? 10,
        facultyId: where?.facultyId ?? 1,
        status: where?.status ?? 'selected',
      };
    });
  });

  describe('Admin faculty endpoints', () => {
    it('allows admin to list faculties', async () => {
      const res = await request(app).get('/api/v1/admin/faculties').set(authHeader('token-admin'));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total', 1);
    });

    it('returns 422 for invalid faculty list query', async () => {
      const res = await request(app)
        .get('/api/v1/admin/faculties?limit=0&offset=-1')
        .set(authHeader('token-admin'));
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('allows admin to create faculty', async () => {
      const res = await request(app)
        .post('/api/v1/admin/faculties')
        .set(authHeader('token-admin'))
        .send({ code: 'ART', name: 'Arts' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ facultyCode: 'ART', facultyName: 'Arts' });
    });

    it('returns 409 when create faculty duplicates code/name', async () => {
      (prisma.faculty.findFirst as jest.Mock).mockResolvedValueOnce({ id: 33 });

      const res = await request(app)
        .post('/api/v1/admin/faculties')
        .set(authHeader('token-admin'))
        .send({ code: 'ENG', name: 'Engineering' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns validation error for invalid faculty create payload', async () => {
      const res = await request(app)
        .post('/api/v1/admin/faculties')
        .set(authHeader('token-admin'))
        .send({ code: 'A' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('allows admin to update faculty', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/faculties/1')
        .set(authHeader('token-admin'))
        .send({ name: 'Arts and Design' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('facultyName', 'Arts and Design');
    });

    it('returns 409 when update faculty conflicts with existing code/name', async () => {
      (prisma.faculty.findFirst as jest.Mock).mockResolvedValueOnce({ id: 90 });

      const res = await request(app)
        .patch('/api/v1/admin/faculties/1')
        .set(authHeader('token-admin'))
        .send({ code: 'ENG' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 when update faculty id not found', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/faculties/999')
        .set(authHeader('token-admin'))
        .send({ name: 'Unknown' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('allows admin to deactivate faculty', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/faculties/1/deactivate')
        .set(authHeader('token-admin'));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('isActive', false);
    });

    it('returns 404 when deactivating unknown faculty', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/faculties/999/deactivate')
        .set(authHeader('token-admin'));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('allows admin to assign faculty to a user', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/500/faculty')
        .set(authHeader('token-admin'))
        .send({ facultyId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('facultyId', 1);
    });

    it('returns 400 when assigning null faculty to role that requires faculty', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/500/faculty')
        .set(authHeader('token-admin'))
        .send({ facultyId: null });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when assigning inactive faculty', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/500/faculty')
        .set(authHeader('token-admin'))
        .send({ facultyId: 3 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid user id in assign faculty', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/abc/faculty')
        .set(authHeader('token-admin'))
        .send({ facultyId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 when assigning faculty to unknown user', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/777/faculty')
        .set(authHeader('token-admin'))
        .send({ facultyId: 1 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 409 when changing faculty for user with contributions', async () => {
      (prisma.contribution.count as jest.Mock).mockImplementation(async ({ where }) => {
        if (where?.userId === 200) return 2;
        if (where?.status === 'selected') return 1;
        return 2;
      });

      const res = await request(app)
        .patch('/api/v1/admin/users/200/faculty')
        .set(authHeader('token-admin'))
        .send({ facultyId: 2 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('allows admin to list users by faculty', async () => {
      const res = await request(app)
        .get('/api/v1/admin/faculties/1/users')
        .set(authHeader('token-admin'));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total', 0);
    });

    it('returns 400 for invalid faculty id when listing users by faculty', async () => {
      const res = await request(app)
        .get('/api/v1/admin/faculties/abc/users')
        .set(authHeader('token-admin'));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for unknown faculty when listing users by faculty', async () => {
      const res = await request(app)
        .get('/api/v1/admin/faculties/999/users')
        .set(authHeader('token-admin'));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('blocks unauthenticated access to admin faculties', async () => {
      const res = await request(app).get('/api/v1/admin/faculties');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('blocks student access to admin faculties', async () => {
      const res = await request(app)
        .get('/api/v1/admin/faculties')
        .set(authHeader('token-student'));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Coordinator and Student faculty scope', () => {
    it('blocks student from coordinator contributions endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/coordinator/contributions')
        .set(authHeader('token-student'));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('blocks student from faculty reports endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/reports/faculty/1/statistics?academicYearId=2024')
        .set(authHeader('token-student'));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows coordinator to list own faculty contributions', async () => {
      const res = await request(app)
        .get('/api/v1/coordinator/contributions')
        .set(authHeader('token-coordinator'));

      expect(res.status).toBe(200);
      expect(prisma.contribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { facultyId: 1 } })
      );
    });

    it('allows coordinator to get own faculty contribution by id', async () => {
      const res = await request(app)
        .get('/api/v1/coordinator/contributions/10')
        .set(authHeader('token-coordinator'));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', 10);
    });

    it('returns 404 when coordinator contribution is not found', async () => {
      const res = await request(app)
        .get('/api/v1/coordinator/contributions/404')
        .set(authHeader('token-coordinator'));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('blocks coordinator without faculty assignment', async () => {
      const res = await request(app)
        .get('/api/v1/coordinator/contributions')
        .set(authHeader('token-coordinator-no-faculty'));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('uses coordinator faculty scope for reports (ignores route facultyId)', async () => {
      const res = await request(app)
        .get('/api/v1/reports/faculty/999/statistics?academicYearId=2024')
        .set(authHeader('token-coordinator'));

      expect(res.status).toBe(200);
      expect(prisma.contribution.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { facultyId: 1, academicYearId: 2024 } })
      );
    });

    it('allows manager to access faculty reports by route facultyId', async () => {
      const res = await request(app)
        .get('/api/v1/reports/faculty/1/statistics?academicYearId=2024')
        .set(authHeader('token-manager'));

      expect(res.status).toBe(200);
      expect(prisma.contribution.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { facultyId: 1, academicYearId: 2024 } })
      );
    });

    it('allows coordinator to access faculty exceptions report', async () => {
      const res = await request(app)
        .get('/api/v1/reports/faculty/1/exceptions?academicYearId=2024')
        .set(authHeader('token-coordinator'));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('missingComment');
      expect(res.body.data).toHaveProperty('overdue');
    });

    it('returns 400 when reports academicYearId is missing', async () => {
      const res = await request(app)
        .get('/api/v1/reports/faculty/1/statistics')
        .set(authHeader('token-manager'));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when manager provides invalid faculty id for reports', async () => {
      const res = await request(app)
        .get('/api/v1/reports/faculty/abc/statistics?academicYearId=2024')
        .set(authHeader('token-manager'));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for coordinator endpoint without token', async () => {
      const res = await request(app).get('/api/v1/coordinator/contributions');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Guest faculty endpoints', () => {
    it('allows guest to list faculties', async () => {
      const res = await request(app).get('/api/v1/guest/faculties');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(expect.any(Array));
    });

    it('allows guest to list selected contributions by faculty', async () => {
      const res = await request(app).get('/api/v1/guest/faculties/1/contributions/selected');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });

    it('returns 400 for invalid guest facultyId', async () => {
      const res = await request(app).get('/api/v1/guest/faculties/abc/contributions/selected');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('allows guest to get selected contribution detail', async () => {
      const res = await request(app).get('/api/v1/guest/contributions/10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', 10);
    });

    it('returns 400 for invalid guest contribution id', async () => {
      const res = await request(app).get('/api/v1/guest/contributions/abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid contribution id');
    });

    it('returns 404 when selected contribution detail is missing', async () => {
      const res = await request(app).get('/api/v1/guest/contributions/404');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
