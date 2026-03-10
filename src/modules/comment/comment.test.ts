import request from 'supertest';
import app from '@/app';
import { db } from '@/shared/database';

describe('Comment API', () => {
  let adminToken: string;
  let studentToken: string;
  let coordinatorToken: string;
  let studentId: number;
  let coordinatorId: number;
  let facultyId: number;
  let academicYearId: number;
  let contributionId: number;
  let commentId: number;

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
        email: 'comment-student@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Comment',
        lastName: 'Student',
        roleId: (await db.role.findFirst({ where: { roleCode: 'STUDENT' } }))!.id,
        facultyId,
      },
    });
    studentId = studentUser.id;

    const coordinatorUser = await db.user.create({
      data: {
        email: 'comment-coordinator@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Comment',
        lastName: 'Coordinator',
        roleId: (await db.role.findFirst({ where: { roleCode: 'COORDINATOR' } }))!.id,
        facultyId,
      },
    });
    coordinatorId = coordinatorUser.id;

    const studentLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'comment-student@test.edu',
      password: 'Student@123',
    });
    studentToken = studentLogin.body.data?.token || '';

    const coordinatorLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'comment-coordinator@test.edu',
      password: 'Coordinator@123',
    });
    coordinatorToken = coordinatorLogin.body.data?.token || '';

    const contribution = await db.contribution.create({
      data: {
        userId: studentId,
        academicYearId,
        facultyId,
        title: 'Test Contribution for Comments',
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
    contributionId = contribution.id;
  });

  afterAll(async () => {
    if (commentId) {
      await db.comment.deleteMany({ where: { id: commentId } });
    }
    await db.contribution.deleteMany({ where: { id: contributionId } });
    await db.user.deleteMany({
      where: { email: { in: ['comment-student@test.edu', 'comment-coordinator@test.edu'] } },
    });
  });

  describe('POST /api/v1/comments', () => {
    it('should create comment as coordinator', async () => {
      const response = await request(app)
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          contributionId,
          content: 'Great work! Please revise the introduction section.',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.content).toContain('Great work');
      expect(response.body.data.userId).toBe(coordinatorId);
      commentId = response.body.data.id;
    });

    it('should allow student to comment on own contribution', async () => {
      const response = await request(app)
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          contributionId,
          content: 'Thank you for the feedback!',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.userId).toBe(studentId);
    });

    it('should reject comment on draft contribution', async () => {
      const draftContribution = await db.contribution.create({
        data: {
          userId: studentId,
          academicYearId,
          facultyId,
          title: 'Draft Contribution',
          status: 'draft',
        },
      });

      const response = await request(app)
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          contributionId: draftContribution.id,
          content: 'Cannot comment on draft',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('draft');

      await db.contribution.delete({ where: { id: draftContribution.id } });
    });

    it('should reject coordinator from different faculty', async () => {
      const otherFaculty = await db.faculty.create({
        data: {
          facultyName: 'Other Faculty',
          facultyCode: 'OTHER',
        },
      });

      const otherCoordinator = await db.user.create({
        data: {
          email: 'other-coordinator@test.edu',
          passwordHash: '$2b$10$test',
          firstName: 'Other',
          lastName: 'Coordinator',
          roleId: (await db.role.findFirst({ where: { roleCode: 'COORDINATOR' } }))!.id,
          facultyId: otherFaculty.id,
        },
      });

      const otherLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'other-coordinator@test.edu',
        password: 'Coordinator@123',
      });

      const response = await request(app)
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${otherLogin.body.data.token}`)
        .send({
          contributionId,
          content: 'Cross-faculty comment',
        });

      expect(response.status).toBe(403);

      await db.user.delete({ where: { id: otherCoordinator.id } });
      await db.faculty.delete({ where: { id: otherFaculty.id } });
    });

    it('should validate content length', async () => {
      const response = await request(app)
        .post('/api/v1/comments')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          contributionId,
          content: '',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/comments', () => {
    it('should list comments for contribution', async () => {
      const response = await request(app)
        .get(`/api/v1/comments?contributionId=${contributionId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.comments)).toBe(true);
      expect(response.body.data.comments.length).toBeGreaterThan(0);
    });

    it('should filter by user', async () => {
      const response = await request(app)
        .get(`/api/v1/comments?userId=${coordinatorId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      const allFromCoordinator = response.body.data.comments.every(
        (c: any) => c.userId === coordinatorId
      );
      expect(allFromCoordinator).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/comments?limit=5&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.limit).toBe(5);
      expect(response.body.data.offset).toBe(0);
    });
  });

  describe('GET /api/v1/comments/:id', () => {
    it('should get comment by id', async () => {
      const response = await request(app)
        .get(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(commentId);
    });

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .get('/api/v1/comments/99999')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/comments/:id', () => {
    it('should update own comment', async () => {
      const response = await request(app)
        .put(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          content: 'Updated comment content',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe('Updated comment content');
    });

    it('should reject updating others comment', async () => {
      const response = await request(app)
        .put(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          content: 'Unauthorized update',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/comments/without-comments', () => {
    it('should list contributions without comments', async () => {
      const noCommentContribution = await db.contribution.create({
        data: {
          userId: studentId,
          academicYearId,
          facultyId,
          title: 'No Comments Yet',
          status: 'submitted',
          submittedAt: new Date(),
        },
      });

      const response = await request(app)
        .get('/api/v1/comments/without-comments')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.contributions)).toBe(true);

      const found = response.body.data.contributions.find(
        (c: any) => c.id === noCommentContribution.id
      );
      expect(found).toBeTruthy();

      await db.contribution.delete({ where: { id: noCommentContribution.id } });
    });
  });

  describe('GET /api/v1/comments/overdue', () => {
    it('should list overdue contributions', async () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const overdueContribution = await db.contribution.create({
        data: {
          userId: studentId,
          academicYearId,
          facultyId,
          title: 'Overdue Contribution',
          status: 'submitted',
          submittedAt: fifteenDaysAgo,
        },
      });

      const response = await request(app)
        .get('/api/v1/comments/overdue')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.contributions)).toBe(true);

      const found = response.body.data.contributions.find(
        (c: any) => c.id === overdueContribution.id
      );
      expect(found).toBeTruthy();
      expect(found.daysOverdue).toBeGreaterThan(0);

      await db.contribution.delete({ where: { id: overdueContribution.id } });
    });
  });

  describe('DELETE /api/v1/comments/:id', () => {
    it('should delete own comment', async () => {
      const newComment = await db.comment.create({
        data: {
          contributionId,
          userId: coordinatorId,
          content: 'Comment to delete',
          commentedAt: new Date(),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/comments/${newComment.id}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);

      const deleted = await db.comment.findUnique({ where: { id: newComment.id } });
      expect(deleted).toBeNull();
    });

    it('should allow admin to delete any comment', async () => {
      const newComment = await db.comment.create({
        data: {
          contributionId,
          userId: studentId,
          content: 'Comment to delete by admin',
          commentedAt: new Date(),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/comments/${newComment.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject deleting others comment', async () => {
      const response = await request(app)
        .delete(`/api/v1/comments/${commentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });
});
