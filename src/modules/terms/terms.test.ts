import request from 'supertest';
import app from '@/app';
import { db } from '@/shared/database';

describe('Terms & Conditions API', () => {
  let adminToken: string;
  let studentToken: string;
  let termsId: number;

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@ewsd.edu',
      password: 'Admin@123',
    });
    adminToken = adminLogin.body.data.token;

    const studentUser = await db.user.findFirst({
      where: { email: { contains: 'student' } },
    });

    if (studentUser) {
      const studentLogin = await request(app).post('/api/v1/auth/login').send({
        email: studentUser.email,
        password: 'Student@123',
      });
      studentToken = studentLogin.body.data?.token || '';
    }
  });

  afterAll(async () => {
    if (termsId) {
      await db.termsCondition.deleteMany({ where: { id: termsId } });
    }
  });

  describe('POST /api/v1/terms', () => {
    it('should create terms as admin', async () => {
      const response = await request(app)
        .post('/api/v1/terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 'v1.0-test',
          content: 'This is a test terms and conditions document with sufficient content.',
          effectiveDate: '2025-01-01T00:00:00Z',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.version).toBe('v1.0-test');
      expect(response.body.data.isActive).toBe(false);
      termsId = response.body.data.id;
    });

    it('should reject duplicate version', async () => {
      const response = await request(app)
        .post('/api/v1/terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 'v1.0-test',
          content: 'Another terms document',
          effectiveDate: '2025-01-01T00:00:00Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .post('/api/v1/terms')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          version: 'v2.0',
          content: 'Unauthorized terms',
          effectiveDate: '2025-01-01T00:00:00Z',
        });

      expect(response.status).toBe(403);
    });

    it('should validate content length', async () => {
      const response = await request(app)
        .post('/api/v1/terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 'v3.0',
          content: 'Short',
          effectiveDate: '2025-01-01T00:00:00Z',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/terms', () => {
    it('should get all terms', async () => {
      const response = await request(app)
        .get('/api/v1/terms')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.terms)).toBe(true);
    });

    it('should filter inactive terms by default', async () => {
      const response = await request(app)
        .get('/api/v1/terms')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const allActive = response.body.data.terms.every((t: any) => t.isActive);
      expect(allActive).toBe(true);
    });

    it('should include inactive when requested', async () => {
      const response = await request(app)
        .get('/api/v1/terms?includeInactive=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.terms)).toBe(true);
    });
  });

  describe('GET /api/v1/terms/active', () => {
    it('should get active terms without authentication', async () => {
      await request(app)
        .put(`/api/v1/terms/${termsId}/set-active`)
        .set('Authorization', `Bearer ${adminToken}`);

      const response = await request(app).get('/api/v1/terms/active');

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(true);
    });
  });

  describe('GET /api/v1/terms/:id', () => {
    it('should get terms by id', async () => {
      const response = await request(app)
        .get(`/api/v1/terms/${termsId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(termsId);
      expect(response.body.data.version).toBe('v1.0-test');
    });

    it('should return 404 for non-existent id', async () => {
      const response = await request(app)
        .get('/api/v1/terms/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/terms/:id', () => {
    it('should update terms as admin', async () => {
      const response = await request(app)
        .put(`/api/v1/terms/${termsId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Updated terms and conditions content with sufficient length.',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toContain('Updated');
    });

    it('should reject unauthorized update', async () => {
      const response = await request(app)
        .put(`/api/v1/terms/${termsId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          content: 'Unauthorized update',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/v1/terms/:id/set-active', () => {
    it('should set terms as active', async () => {
      const response = await request(app)
        .put(`/api/v1/terms/${termsId}/set-active`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(true);
    });

    it('should unset previous active terms', async () => {
      const newTerms = await request(app)
        .post('/api/v1/terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          version: 'v2.0-test',
          content: 'New terms and conditions for testing active switch.',
          effectiveDate: '2025-02-01T00:00:00Z',
        });

      await request(app)
        .put(`/api/v1/terms/${newTerms.body.data.id}/set-active`)
        .set('Authorization', `Bearer ${adminToken}`);

      const oldTerms = await request(app)
        .get(`/api/v1/terms/${termsId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(oldTerms.body.data.isActive).toBe(false);

      await db.termsCondition.delete({ where: { id: newTerms.body.data.id } });
    });
  });

  describe('DELETE /api/v1/terms/:id', () => {
    it('should reject deleting active terms', async () => {
      await request(app)
        .put(`/api/v1/terms/${termsId}/set-active`)
        .set('Authorization', `Bearer ${adminToken}`);

      const response = await request(app)
        .delete(`/api/v1/terms/${termsId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('active');
    });

    it('should delete inactive terms without agreements', async () => {
      await request(app)
        .put(`/api/v1/terms/${termsId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      const response = await request(app)
        .delete(`/api/v1/terms/${termsId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });
});
