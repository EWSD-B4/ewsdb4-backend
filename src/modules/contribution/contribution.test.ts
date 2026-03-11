import request from 'supertest';
import app from '@/app';
import { db } from '@/shared/database';

describe('Contribution API', () => {
  let studentToken: string;
  let coordinatorToken: string;
  let studentId: number;
  let facultyId: number;
  let academicYearId: number;
  let contributionId: number;
  let termsId: number;

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/login').send({
      email: 'admin@ewsd.edu',
      password: 'Admin@123',
    });
    const faculty = await db.faculty.findFirst({where: {isActive: true}});
    facultyId = faculty!.id;

    const academicYear = await db.academicYear.findFirst({
      where: {isActive: true},
    });
    academicYearId = academicYear!.id;

    const terms = await db.termsCondition.create({
      data: {
        version: 'test-v1.0',
        content: 'Test terms and conditions for contribution testing',
        effectiveDate: new Date(),
        isActive: true,
      },
    });
    termsId = terms.id;

    const studentUser = await db.user.create({
      data: {
        email: 'contrib-student@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Contribution',
        lastName: 'Student',
        roleId: (await db.role.findFirst({where: {roleCode: 'STUDENT'}}))!.id,
        facultyId,
      },
    });
    studentId = studentUser.id;
    await db.user.create({
      data: {
        email: 'contrib-coordinator@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Contribution',
        lastName: 'Coordinator',
        roleId: (await db.role.findFirst({where: {roleCode: 'COORDINATOR'}}))!.id,
        facultyId,
      },
    });
    const studentLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'contrib-student@test.edu',
      password: 'Student@123',
    });
    studentToken = studentLogin.body.data?.token || '';

    const coordinatorLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'contrib-coordinator@test.edu',
      password: 'Coordinator@123',
    });
    coordinatorToken = coordinatorLogin.body.data?.token || '';
  });

  afterAll(async () => {
    if (contributionId) {
      await db.contribution.deleteMany({ where: { id: contributionId } });
    }
    await db.user.deleteMany({
      where: { email: { in: ['contrib-student@test.edu', 'contrib-coordinator@test.edu'] } },
    });
    await db.termsCondition.deleteMany({ where: { id: termsId } });
  });

  describe('POST /api/v1/contributions', () => {
    it('should create contribution as student', async () => {
      const response = await request(app)
        .post('/api/v1/contributions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'My First Contribution',
          academicYearId,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('My First Contribution');
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.userId).toBe(studentId);
      contributionId = response.body.data.id;
    });

    it('should reject contribution without faculty', async () => {
      const noFacultyUser = await db.user.create({
        data: {
          email: 'nofaculty@test.edu',
          passwordHash: '$2b$10$test',
          firstName: 'No',
          lastName: 'Faculty',
          roleId: (await db.role.findFirst({ where: { roleCode: 'STUDENT' } }))!.id,
        },
      });

      const login = await request(app).post('/api/v1/auth/login').send({
        email: 'nofaculty@test.edu',
        password: 'Test@123',
      });

      const response = await request(app)
        .post('/api/v1/contributions')
        .set('Authorization', `Bearer ${login.body.data.token}`)
        .send({
          title: 'Invalid Contribution',
          academicYearId,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('faculty');

      await db.user.delete({ where: { id: noFacultyUser.id } });
    });

    it('should validate title length', async () => {
      const response = await request(app)
        .post('/api/v1/contributions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'AB',
          academicYearId,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/contributions', () => {
    it('should list student own contributions', async () => {
      const response = await request(app)
        .get('/api/v1/contributions')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.contributions)).toBe(true);
      expect(response.body.data.contributions.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/contributions?status=draft')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const allDraft = response.body.data.contributions.every((c: any) => c.status === 'draft');
      expect(allDraft).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/contributions?limit=5&offset=0')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.limit).toBe(5);
      expect(response.body.data.offset).toBe(0);
    });
  });

  describe('GET /api/v1/contributions/:id', () => {
    it('should get contribution by id', async () => {
      const response = await request(app)
        .get(`/api/v1/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(contributionId);
      expect(response.body.data.title).toBe('My First Contribution');
    });

    it('should return 404 for non-existent contribution', async () => {
      const response = await request(app)
        .get('/api/v1/contributions/99999')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/contributions/:id', () => {
    it('should update own contribution', async () => {
      const response = await request(app)
        .put(`/api/v1/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Updated Contribution Title',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('Updated Contribution Title');
    });

    it('should reject updating others contribution', async () => {
      const response = await request(app)
        .put(`/api/v1/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          title: 'Unauthorized Update',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/v1/contributions/:id/submit', () => {
    beforeAll(async () => {
      await db.contributionFile.create({
        data: {
          contributionId,
          fileType: 'docx',
          originalName: 'test.docx',
          storedName: 'test-stored.docx',
          filePath: '/test/path.docx',
          fileSize: BigInt(1024),
        },
      });
    });

    it('should submit contribution with terms agreement', async () => {
      const response = await request(app)
        .post(`/api/v1/contributions/${contributionId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          termsId,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('submitted');
      expect(response.body.data.submittedAt).toBeTruthy();

      const agreement = await db.agreement.findFirst({
        where: { contributionId, userId: studentId },
      });
      expect(agreement).toBeTruthy();
    });

    it('should reject resubmission', async () => {
      const response = await request(app)
        .post(`/api/v1/contributions/${contributionId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          termsId,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already been submitted');
    });
  });

  describe('POST /api/v1/contributions/:id/select', () => {
    it('should select contribution as coordinator', async () => {
      const response = await request(app)
        .post(`/api/v1/contributions/${contributionId}/select`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          selected: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('selected');
      expect(response.body.data.publishedAt).toBeTruthy();
    });

    it('should reject selection by student', async () => {
      const response = await request(app)
        .post(`/api/v1/contributions/${contributionId}/select`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selected: false,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/contributions/:id', () => {
    it('should reject deleting submitted contribution', async () => {
      const response = await request(app)
        .delete(`/api/v1/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('draft');
    });

    it('should delete draft contribution', async () => {
      const draftContribution = await db.contribution.create({
        data: {
          userId: studentId,
          academicYearId,
          facultyId,
          title: 'Draft to Delete',
          status: 'draft',
        },
      });

      const response = await request(app)
        .delete(`/api/v1/contributions/${draftContribution.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);

      const deleted = await db.contribution.findUnique({
        where: { id: draftContribution.id },
      });
      expect(deleted).toBeNull();
    });
  });
});
