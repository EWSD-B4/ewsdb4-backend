import request from 'supertest';
import app from '@/app';
import { db } from '@/shared/database';

describe('Notification API', () => {
  let studentToken: string;
  let coordinatorToken: string;
  let studentId: number;
  let coordinatorId: number;
  let facultyId: number;
  let notificationId: number;

  beforeAll(async () => {
    const faculty = await db.faculty.findFirst({ where: { isActive: true } });
    facultyId = faculty!.id;

    const studentUser = await db.user.create({
      data: {
        email: 'notif-student@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Notification',
        lastName: 'Student',
        roleId: (await db.role.findFirst({ where: { roleCode: 'STUDENT' } }))!.id,
        facultyId,
      },
    });
    studentId = studentUser.id;

    const coordinatorUser = await db.user.create({
      data: {
        email: 'notif-coordinator@test.edu',
        passwordHash: '$2b$10$test',
        firstName: 'Notification',
        lastName: 'Coordinator',
        roleId: (await db.role.findFirst({ where: { roleCode: 'COORDINATOR' } }))!.id,
        facultyId,
      },
    });
    coordinatorId = coordinatorUser.id;

    const studentLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'notif-student@test.edu',
      password: 'Student@123',
    });
    studentToken = studentLogin.body.data?.token || '';

    const coordinatorLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'notif-coordinator@test.edu',
      password: 'Coordinator@123',
    });
    coordinatorToken = coordinatorLogin.body.data?.token || '';

    const notification = await db.notification.create({
      data: {
        userId: studentId,
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test notification',
        notificationAt: new Date(),
        isRead: false,
      },
    });
    notificationId = notification.id;
  });

  afterAll(async () => {
    await db.notification.deleteMany({ where: { userId: { in: [studentId, coordinatorId] } } });
    await db.user.deleteMany({
      where: { email: { in: ['notif-student@test.edu', 'notif-coordinator@test.edu'] } },
    });
  });

  describe('GET /api/v1/notifications', () => {
    it('should get user notifications', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.notifications)).toBe(true);
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
    });

    it('should filter unread notifications', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const allUnread = response.body.data.notifications.every((n: any) => !n.isRead);
      expect(allUnread).toBe(true);
    });

    it('should only show own notifications', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      const allOwnNotifications = response.body.data.notifications.every(
        (n: any) => n.userId === coordinatorId
      );
      expect(allOwnNotifications).toBe(true);
    });
  });

  describe('PUT /api/v1/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const response = await request(app)
        .put(`/api/v1/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isRead).toBe(true);
    });

    it('should return 404 for other user notification', async () => {
      const response = await request(app)
        .put(`/api/v1/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      await db.notification.create({
        data: {
          userId: studentId,
          type: 'test2',
          title: 'Another Test',
          message: 'Another test notification',
          notificationAt: new Date(),
          isRead: false,
        },
      });

      const response = await request(app)
        .put('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);

      const unreadCount = await db.notification.count({
        where: { userId: studentId, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });
  });

  describe('DELETE /api/v1/notifications/:id', () => {
    it('should delete own notification', async () => {
      const newNotification = await db.notification.create({
        data: {
          userId: studentId,
          type: 'to-delete',
          title: 'To Delete',
          message: 'This will be deleted',
          notificationAt: new Date(),
          isRead: false,
        },
      });

      const response = await request(app)
        .delete(`/api/v1/notifications/${newNotification.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);

      const deleted = await db.notification.findUnique({
        where: { id: newNotification.id },
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for other user notification', async () => {
      const response = await request(app)
        .delete(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(404);
    });
  });
});
