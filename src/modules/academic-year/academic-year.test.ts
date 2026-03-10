import request from 'supertest';
import app from '@/app';
import { db } from '@/shared/database';

describe('Academic Year API', () => {
  let adminToken: string;
  let studentToken: string;
  let academicYearId: number;

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@ewsd.edu',
      password: 'Admin@123',
    });
    adminToken = adminLogin.body.data.token;
    await db.user.create({
      data: {
        email: 'student@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Test',
        lastName: 'Student',
        roleId: (await db.role.findFirst({ where: { roleCode: 'STUDENT' } }))!.id,
        facultyId: (await db.faculty.findFirst())!.id,
      },
    });
    const studentLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'student@test.edu',
      password: 'Student@123',
    });
    studentToken = studentLogin.body.data?.token || '';
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: 'student@test.edu' } });
    if (academicYearId) {
      await db.academicYear.deleteMany({ where: { id: academicYearId } });
    }
  });

  describe('POST /api/v1/academic-years', () => {
    it('should create academic year as admin', async () => {
      const response = await request(app)
        .post('/api/v1/academic-years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          yearName: '2025/26',
          startDate: '2025-09-01',
          endDate: '2026-06-30',
          closureDate: '2026-03-31T23:59:59Z',
          closureFinalDate: '2026-04-14T23:59:59Z',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.yearName).toBe('2025/26');
      expect(response.body.data.isCurrent).toBe(false);
      academicYearId = response.body.data.id;
    });

    it('should reject duplicate year name', async () => {
      const response = await request(app)
        .post('/api/v1/academic-years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          yearName: '2025/26',
          startDate: '2025-09-01',
          endDate: '2026-06-30',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .post('/api/v1/academic-years')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          yearName: '2026/27',
          startDate: '2026-09-01',
          endDate: '2027-06-30',
        });

      expect(response.status).toBe(403);
    });

    it('should validate end date after start date', async () => {
      const response = await request(app)
        .post('/api/v1/academic-years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          yearName: '2027/28',
          startDate: '2027-09-01',
          endDate: '2027-06-30',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/academic-years', () => {
    it('should get all academic years', async () => {
      const response = await request(app)
        .get('/api/v1/academic-years')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.academicYears)).toBe(true);
      expect(response.body.data.academicYears.length).toBeGreaterThan(0);
    });

    it('should filter inactive years by default', async () => {
      const response = await request(app)
        .get('/api/v1/academic-years')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const allActive = response.body.data.academicYears.every((year: any) => year.isActive);
      expect(allActive).toBe(true);
    });

    it('should include inactive years when requested', async () => {
      const response = await request(app)
        .get('/api/v1/academic-years?includeInactive=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.academicYears)).toBe(true);
    });
  });

  describe('GET /api/v1/academic-years/current', () => {
    it('should get current academic year', async () => {
      await request(app)
        .put(`/api/v1/academic-years/${academicYearId}/set-current`)
        .set('Authorization', `Bearer ${adminToken}`);

      const response = await request(app)
        .get('/api/v1/academic-years/current')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isCurrent).toBe(true);
    });
  });

  describe('GET /api/v1/academic-years/:id', () => {
    it('should get academic year by id', async () => {
      const response = await request(app)
        .get(`/api/v1/academic-years/${academicYearId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(academicYearId);
      expect(response.body.data.yearName).toBe('2025/26');
    });

    it('should return 404 for non-existent id', async () => {
      const response = await request(app)
        .get('/api/v1/academic-years/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/academic-years/:id', () => {
    it('should update academic year as admin', async () => {
      const response = await request(app)
        .put(`/api/v1/academic-years/${academicYearId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          closureDate: '2026-04-15T23:59:59Z',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.closureDate).toBe('2026-04-15T23:59:59.000Z');
    });

    it('should reject unauthorized update', async () => {
      const response = await request(app)
        .put(`/api/v1/academic-years/${academicYearId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          yearName: 'Updated',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/v1/academic-years/:id/set-current', () => {
    it('should set academic year as current', async () => {
      const response = await request(app)
        .put(`/api/v1/academic-years/${academicYearId}/set-current`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isCurrent).toBe(true);
    });

    it('should unset previous current year', async () => {
      const newYear = await request(app)
        .post('/api/v1/academic-years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          yearName: '2026/27',
          startDate: '2026-09-01',
          endDate: '2027-06-30',
        });

      await request(app)
        .put(`/api/v1/academic-years/${newYear.body.data.id}/set-current`)
        .set('Authorization', `Bearer ${adminToken}`);

      const oldYear = await request(app)
        .get(`/api/v1/academic-years/${academicYearId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(oldYear.body.data.isCurrent).toBe(false);

      await db.academicYear.delete({ where: { id: newYear.body.data.id } });
    });
  });

  describe('DELETE /api/v1/academic-years/:id', () => {
    it('should soft delete academic year with contributions', async () => {
      const yearWithContributions = await db.academicYear.create({
        data: {
          yearName: '2024/25',
          startDate: new Date('2024-09-01'),
          endDate: new Date('2025-06-30'),
        },
      });

      await db.contribution.create({
        data: {
          userId: (await db.user.findFirst({ where: { email: 'student@test.edu' } }))!.id,
          academicYearId: yearWithContributions.id,
          facultyId: (await db.faculty.findFirst())!.id,
          title: 'Test Contribution',
          status: 'draft',
        },
      });

      const response = await request(app)
        .delete(`/api/v1/academic-years/${yearWithContributions.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const deletedYear = await db.academicYear.findUnique({
        where: { id: yearWithContributions.id },
      });
      expect(deletedYear?.isActive).toBe(false);

      await db.contribution.deleteMany({ where: { academicYearId: yearWithContributions.id } });
      await db.academicYear.delete({ where: { id: yearWithContributions.id } });
    });

    it('should reject deleting current academic year', async () => {
      const response = await request(app)
        .delete(`/api/v1/academic-years/${academicYearId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('current');
    });
  });
});
