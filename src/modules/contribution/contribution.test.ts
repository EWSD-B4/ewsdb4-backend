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

  describe('POST /api/v1/student/contributions/submit', () => {
    it('should create and submit contribution as student with files', async () => {
      const response = await request(app)
        .post('/api/v1/student/contributions/submit')
        .set('Authorization', `Bearer ${studentToken}`)
        .field('title', 'My First Contribution')
        .field('academicYearId', academicYearId)
        .attach('docx', Buffer.from('fake docx content'), 'test.docx')
        .attach('images', Buffer.from('fake image'), 'test.jpg');

      expect(response.status).toBe(201);
      expect(response.body.data.contribution.title).toBe('My First Contribution');
      expect(response.body.data.contribution.status).toBe('submitted');
      expect(response.body.data.contribution.userId).toBe(studentId);
      contributionId = response.body.data.contribution.id;
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
        .post('/api/v1/student/contributions/submit')
        .set('Authorization', `Bearer ${login.body.data.token}`)
        .field('title', 'Invalid Contribution')
        .field('academicYearId', academicYearId)
        .attach('docx', Buffer.from('fake docx'), 'test.docx');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('faculty');

      await db.user.delete({ where: { id: noFacultyUser.id } });
    });

    it('should validate title length', async () => {
      const response = await request(app)
        .post('/api/v1/student/contributions/submit')
        .set('Authorization', `Bearer ${studentToken}`)
        .field('title', 'AB')
        .field('academicYearId', academicYearId)
        .attach('docx', Buffer.from('fake docx'), 'test.docx');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/student/contributions', () => {
    it('should list student own contributions', async () => {
      const response = await request(app)
        .get('/api/v1/student/contributions')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/student/contributions?status=submitted')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const allSubmitted = response.body.data.items.every((c: any) => c.status === 'submitted');
      expect(allSubmitted).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/student/contributions?limit=5&offset=0')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.meta.pagination.limit).toBe(5);
      expect(response.body.meta.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/v1/coordinator/contributions/:id', () => {
    it('should get contribution by id as coordinator', async () => {
      const response = await request(app)
        .get(`/api/v1/coordinator/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(contributionId);
      expect(response.body.data.title).toBe('My First Contribution');
    });

    it('should return 404 for non-existent contribution', async () => {
      const response = await request(app)
        .get('/api/v1/coordinator/contributions/99999')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/student/contributions/:id', () => {
    it('should not allow update of submitted contribution', async () => {
      const response = await request(app)
        .put(`/api/v1/student/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Updated Contribution Title',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('draft or rejected');
    });

    it('should reject updating others contribution', async () => {
      const otherContribution = await db.contribution.create({
        data: {
          userId: (await db.user.findFirst({ where: { email: 'contrib-coordinator@test.edu' } }))!.id,
          academicYearId,
          facultyId,
          title: 'Other User Contribution',
          status: 'draft',
        },
      });

      const response = await request(app)
        .put(`/api/v1/student/contributions/${otherContribution.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Unauthorized Update',
        });

      expect(response.status).toBe(404);
      await db.contribution.delete({ where: { id: otherContribution.id } });
    });
  });

  describe('Contribution submission flow', () => {
    it('should have contribution already submitted from creation', async () => {
      const contribution = await db.contribution.findUnique({
        where: { id: contributionId },
      });

      expect(contribution).toBeTruthy();
      expect(contribution!.status).toBe('submitted');
      expect(contribution!.submittedAt).toBeTruthy();
      expect(contribution!.commentDueDate).toBeTruthy();
    });
  });

  describe('POST /api/v1/coordinator/contributions/:id/select', () => {
    it('should select contribution as coordinator with comment', async () => {
      const response = await request(app)
        .post(`/api/v1/coordinator/contributions/${contributionId}/select`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          comment: 'This is an excellent contribution that meets all our quality standards.',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.contribution.status).toBe('selected');
      expect(response.body.data.comment).toBeTruthy();
    });

    it('should reject selection by student', async () => {
      const response = await request(app)
        .post(`/api/v1/coordinator/contributions/${contributionId}/select`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          comment: 'Student trying to select',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Coordinator actions', () => {
    it('should list contributions for coordinator', async () => {
      const response = await request(app)
        .get('/api/v1/coordinator/contributions')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should update contribution status as coordinator', async () => {
      const response = await request(app)
        .put(`/api/v1/coordinator/contributions/${contributionId}/status`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          status: 'published',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('published');
      expect(response.body.data.publishedAt).toBeTruthy();
    });
  });
});
