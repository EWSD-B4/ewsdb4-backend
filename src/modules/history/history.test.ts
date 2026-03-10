import request from 'supertest';
import app from '@/app';
import { db } from '@/shared/database';

describe('Submission History API', () => {
  let adminToken: string;
  let studentToken: string;
  let studentId: number;
  let facultyId: number;
  let academicYearId: number;
  let contributionId: number;

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@ewsd.edu',
      password: 'Admin@123',
    });
    adminToken = adminLogin.body.data.token;

    const faculty = await db.faculty.findFirst({ where: { isActive: true } });
    facultyId = faculty!.id;

    const academicYear = await db.academicYear.findFirst({ where: { isActive: true } });
    academicYearId = academicYear!.id;

    const studentUser = await db.user.create({
      data: {
        email: 'history-student@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'History',
        lastName: 'Student',
        roleId: (await db.role.findFirst({ where: { roleCode: 'STUDENT' } }))!.id,
        facultyId,
      },
    });
    studentId = studentUser.id;

    const studentLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'history-student@test.edu',
      password: 'Student@123',
    });
    studentToken = studentLogin.body.data?.token || '';

    const contribution = await db.contribution.create({
      data: {
        userId: studentId,
        academicYearId,
        facultyId,
        title: 'Test History Contribution',
        status: 'draft',
      },
    });
    contributionId = contribution.id;

    await db.submissionHistory.create({
      data: {
        contributionId,
        userId: studentId,
        action: 'created',
        actionDate: new Date(),
      },
    });

    await db.submissionHistory.create({
      data: {
        contributionId,
        userId: studentId,
        action: 'updated',
        note: 'Updated title',
        actionDate: new Date(),
      },
    });
  });

  afterAll(async () => {
    await db.submissionHistory.deleteMany({ where: { contributionId } });
    await db.contribution.deleteMany({ where: { id: contributionId } });
    await db.user.deleteMany({ where: { email: 'history-student@test.edu' } });
  });

  describe('GET /api/v1/history', () => {
    it('should get all history as admin', async () => {
      const response = await request(app)
        .get('/api/v1/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.history)).toBe(true);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should filter by contribution ID', async () => {
      const response = await request(app)
        .get(`/api/v1/history?contributionId=${contributionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const allMatchContribution = response.body.data.history.every(
        (h: any) => h.contributionId === contributionId
      );
      expect(allMatchContribution).toBe(true);
    });

    it('should filter by user ID', async () => {
      const response = await request(app)
        .get(`/api/v1/history?userId=${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const allMatchUser = response.body.data.history.every((h: any) => h.userId === studentId);
      expect(allMatchUser).toBe(true);
    });

    it('should filter by action', async () => {
      const response = await request(app)
        .get('/api/v1/history?action=created')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const allMatchAction = response.body.data.history.every((h: any) => h.action === 'created');
      expect(allMatchAction).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/history?limit=5&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.limit).toBe(5);
      expect(response.body.data.offset).toBe(0);
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/v1/history')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/history/contributions/:contributionId', () => {
    it('should get contribution history', async () => {
      const response = await request(app)
        .get(`/api/v1/history/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.history)).toBe(true);
      expect(response.body.data.history.length).toBeGreaterThanOrEqual(2);
    });

    it('should order history chronologically', async () => {
      const response = await request(app)
        .get(`/api/v1/history/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const history = response.body.data.history;
      expect(history[0].action).toBe('created');
      expect(history[1].action).toBe('updated');
    });
  });

  describe('GET /api/v1/history/users/:userId', () => {
    it('should get user activity history', async () => {
      const response = await request(app)
        .get(`/api/v1/history/users/${studentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.history)).toBe(true);
      const allMatchUser = response.body.data.history.every((h: any) => h.userId === studentId);
      expect(allMatchUser).toBe(true);
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get(`/api/v1/history/users/${studentId}?limit=1`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.history.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/v1/history/audit-trail', () => {
    it('should get audit trail for date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .get(
          `/api/v1/history/audit-trail?startDate=${yesterday.toISOString()}&endDate=${tomorrow.toISOString()}`
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.history)).toBe(true);
    });

    it('should reject non-admin access', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app)
        .get(
          `/api/v1/history/audit-trail?startDate=${yesterday.toISOString()}&endDate=${today.toISOString()}`
        )
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });
});
