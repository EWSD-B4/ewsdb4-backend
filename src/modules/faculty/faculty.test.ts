import request from 'supertest';
import app from '@/app';
import { db } from '@/shared/database';

describe('Faculty API', () => {
  let adminToken: string;
  let coordinatorToken: string;
  let facultyId: number;

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@ewsd.edu',
      password: 'Admin@123',
    });
    adminToken = adminLogin.body.data.token;

    const faculty = await db.faculty.findFirst();
    const coordinatorUser = await db.user.create({
      data: {
        email: 'coordinator@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Test',
        lastName: 'Coordinator',
        roleId: (await db.role.findFirst({ where: { roleCode: 'COORDINATOR' } }))!.id,
        facultyId: faculty!.id,
      },
    });

    const coordinatorLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'coordinator@test.edu',
      password: 'Coordinator@123',
    });
    coordinatorToken = coordinatorLogin.body.data?.token || '';
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: 'coordinator@test.edu' } });
    if (facultyId) {
      await db.faculty.deleteMany({ where: { id: facultyId } });
    }
  });

  describe('POST /api/v1/admin/faculties', () => {
    it('should create faculty as admin', async () => {
      const response = await request(app)
        .post('/api/v1/admin/faculties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TEST',
          name: 'Test Faculty',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.facultyCode).toBe('TEST');
      expect(response.body.data.facultyName).toBe('Test Faculty');
      facultyId = response.body.data.id;
    });

    it('should reject duplicate faculty code', async () => {
      const response = await request(app)
        .post('/api/v1/admin/faculties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TEST',
          name: 'Another Faculty',
        });

      expect(response.status).toBe(409);
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .post('/api/v1/admin/faculties')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          code: 'UNAUTH',
          name: 'Unauthorized Faculty',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/faculties', () => {
    it('should list all faculties', async () => {
      const response = await request(app)
        .get('/api/v1/admin/faculties')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should filter by search term', async () => {
      const response = await request(app)
        .get('/api/v1/admin/faculties?search=TEST')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(response.body.data.items[0].facultyCode).toContain('TEST');
    });

    it('should filter by active status', async () => {
      const response = await request(app)
        .get('/api/v1/admin/faculties?isActive=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const allActive = response.body.data.items.every((f: any) => f.isActive);
      expect(allActive).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/admin/faculties?limit=5&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.limit).toBe(5);
      expect(response.body.data.offset).toBe(0);
    });
  });

  describe('PUT /api/v1/admin/faculties/:id', () => {
    it('should update faculty as admin', async () => {
      const response = await request(app)
        .put(`/api/v1/admin/faculties/${facultyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Test Faculty',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.facultyName).toBe('Updated Test Faculty');
    });

    it('should reject duplicate name', async () => {
      const existingFaculty = await db.faculty.findFirst({
        where: { id: { not: facultyId } },
      });

      const response = await request(app)
        .put(`/api/v1/admin/faculties/${facultyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: existingFaculty!.facultyName,
        });

      expect(response.status).toBe(409);
    });

    it('should return 404 for non-existent faculty', async () => {
      const response = await request(app)
        .put('/api/v1/admin/faculties/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non-existent',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/admin/faculties/:id', () => {
    it('should deactivate faculty', async () => {
      const response = await request(app)
        .delete(`/api/v1/admin/faculties/${facultyId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const deactivatedFaculty = await db.faculty.findUnique({
        where: { id: facultyId },
      });
      expect(deactivatedFaculty?.isActive).toBe(false);
    });

    it('should return 404 for non-existent faculty', async () => {
      const response = await request(app)
        .delete('/api/v1/admin/faculties/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });
});
