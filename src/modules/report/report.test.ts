import request from 'supertest';
import app from '@/app';
import { db } from '@/shared/database';

describe('Report API', () => {
  let adminToken: string;
  let coordinatorToken: string;
  let studentToken: string;
  let facultyId: number;
  let academicYearId: number;

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

    const coordinatorUser = await db.user.create({
      data: {
        email: 'report-coordinator@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Report',
        lastName: 'Coordinator',
        roleId: (await db.role.findFirst({ where: { roleCode: 'COORDINATOR' } }))!.id,
        facultyId,
      },
    });

    const studentUser = await db.user.create({
      data: {
        email: 'report-student@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Report',
        lastName: 'Student',
        roleId: (await db.role.findFirst({ where: { roleCode: 'STUDENT' } }))!.id,
        facultyId,
      },
    });

    const coordinatorLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'report-coordinator@test.edu',
      password: 'Coordinator@123',
    });
    coordinatorToken = coordinatorLogin.body.data?.token || '';

    const studentLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'report-student@test.edu',
      password: 'Student@123',
    });
    studentToken = studentLogin.body.data?.token || '';

    await db.contribution.create({
      data: {
        userId: studentUser.id,
        academicYearId,
        facultyId,
        title: 'Test Report Contribution',
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await db.contribution.deleteMany({
      where: { title: 'Test Report Contribution' },
    });
    await db.user.deleteMany({
      where: { email: { in: ['report-coordinator@test.edu', 'report-student@test.edu'] } },
    });
  });

  describe('GET /api/v1/reports/contributions-by-faculty', () => {
    it('should get contributions by faculty report', async () => {
      const response = await request(app)
        .get('/api/v1/reports/contributions-by-faculty')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('facultyName');
      expect(response.body.data[0]).toHaveProperty('contributionCount');
    });

    it('should filter by academic year', async () => {
      const response = await request(app)
        .get(`/api/v1/reports/contributions-by-faculty?academicYearId=${academicYearId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const allMatchYear = response.body.data.every(
        (item: any) => item.academicYearId === academicYearId
      );
      expect(allMatchYear).toBe(true);
    });

    it('should filter by faculty', async () => {
      const response = await request(app)
        .get(`/api/v1/reports/contributions-by-faculty?facultyId=${facultyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const allMatchFaculty = response.body.data.every((item: any) => item.facultyId === facultyId);
      expect(allMatchFaculty).toBe(true);
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/api/v1/reports/contributions-by-faculty')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/reports/contributors-by-faculty', () => {
    it('should get contributors by faculty report', async () => {
      const response = await request(app)
        .get('/api/v1/reports/contributors-by-faculty')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('facultyName');
      expect(response.body.data[0]).toHaveProperty('contributorCount');
    });
  });

  describe('GET /api/v1/reports/contribution-percentages', () => {
    it('should get contribution percentages', async () => {
      const response = await request(app)
        .get(`/api/v1/reports/contribution-percentages?academicYearId=${academicYearId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('percentage');

      const totalPercentage = response.body.data.reduce(
        (sum: number, item: any) => sum + item.percentage,
        0
      );
      expect(totalPercentage).toBeCloseTo(100, 0);
    });

    it('should require academic year ID', async () => {
      const response = await request(app)
        .get('/api/v1/reports/contribution-percentages')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/reports/without-comments', () => {
    it('should get contributions without comments', async () => {
      const response = await request(app)
        .get('/api/v1/reports/without-comments')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should allow admin to see all faculties', async () => {
      const response = await request(app)
        .get('/api/v1/reports/without-comments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/reports/overdue-comments', () => {
    it('should get overdue contributions', async () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const overdueContribution = await db.contribution.create({
        data: {
          userId: (await db.user.findFirst({ where: { email: 'report-student@test.edu' } }))!.id,
          academicYearId,
          facultyId,
          title: 'Overdue Report Contribution',
          status: 'submitted',
          submittedAt: fifteenDaysAgo,
        },
      });

      const response = await request(app)
        .get('/api/v1/reports/overdue-comments')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);

      const found = response.body.data.find((item: any) => item.id === overdueContribution.id);
      expect(found).toBeTruthy();
      expect(found.daysSinceSubmission).toBeGreaterThan(14);

      await db.contribution.delete({ where: { id: overdueContribution.id } });
    });
  });

  describe('GET /api/v1/reports/system-usage', () => {
    it('should get system usage report', async () => {
      const response = await request(app)
        .get('/api/v1/reports/system-usage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('totalContributions');
      expect(response.body.data).toHaveProperty('totalComments');
      expect(response.body.data).toHaveProperty('contributionsByStatus');
      expect(Array.isArray(response.body.data.contributionsByStatus)).toBe(true);
    });

    it('should reject non-admin access', async () => {
      const response = await request(app)
        .get('/api/v1/reports/system-usage')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/reports/faculty-statistics', () => {
    it('should get faculty statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/reports/faculty-statistics?facultyId=${facultyId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalContributions');
      expect(response.body.data).toHaveProperty('selectedContributions');
      expect(response.body.data).toHaveProperty('distinctContributors');
    });

    it('should filter by academic year', async () => {
      const response = await request(app)
        .get(
          `/api/v1/reports/faculty-statistics?facultyId=${facultyId}&academicYearId=${academicYearId}`
        )
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalContributions');
    });
  });
});
