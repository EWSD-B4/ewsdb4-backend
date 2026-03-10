import { db } from '@/shared/database';
import logger from '@/shared/logger';
import { NotFoundError } from '@/shared/errors/AppError';
import { Try } from '@/shared/utils/Try';
import {
  NotificationResponse,
  CreateNotificationRequest,
  SendEmailRequest,
  NotificationType,
} from './notification.types';

class NotificationService {
  async createNotification(data: CreateNotificationRequest): Promise<NotificationResponse> {
    return Try.execute(async () => {
      const notification = await db.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data || null,
          notificationAt: new Date(),
          isRead: false,
        },
      });

      logger.info(`Notification created for user ${data.userId}: ${data.type}`);

      return this.formatNotification(notification);
    }).orElseThrow('Error creating notification');
  }

  async getUserNotifications(
    userId: number,
    unreadOnly = false
  ): Promise<NotificationResponse[]> {
    return Try.execute(async () => {
      const where: any = { userId };
      if (unreadOnly) {
        where.isRead = false;
      }

      const notifications = await db.notification.findMany({
        where,
        orderBy: { notificationAt: 'desc' },
        take: 50,
      });

      return notifications.map((n) => this.formatNotification(n));
    }).orElseThrow('Error fetching notifications');
  }

  async markAsRead(id: number, userId: number): Promise<NotificationResponse> {
    return Try.execute(async () => {
      const notification = await db.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      const updated = await db.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return this.formatNotification(updated);
    }).orElseThrow('Error marking notification as read');
  }

  async markAllAsRead(userId: number): Promise<void> {
    return Try.execute(async () => {
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      logger.info(`All notifications marked as read for user ${userId}`);
    }).orElseThrow('Error marking all notifications as read');
  }

  async deleteNotification(id: number, userId: number): Promise<void> {
    return Try.execute(async () => {
      const notification = await db.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      await db.notification.delete({ where: { id } });

      logger.info(`Notification deleted: ${id}`);
    }).orElseThrow('Error deleting notification');
  }

  async sendEmail(data: SendEmailRequest): Promise<void> {
    return Try.execute(async () => {
      const recipient = await db.user.findUnique({
        where: { id: data.recipientId },
      });

      if (!recipient) {
        throw new NotFoundError('Recipient not found');
      }

      const emailLog = await db.emailLog.create({
        data: {
          senderId: data.senderId || null,
          recipientId: data.recipientId,
          type: data.type,
          subject: data.subject,
          body: data.body,
          status: 'pending',
        },
      });

      try {
        logger.info(`Email queued: ${data.subject} to ${recipient.email}`);

        await db.emailLog.update({
          where: { id: emailLog.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
          },
        });
      } catch (error) {
        await db.emailLog.update({
          where: { id: emailLog.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        throw error;
      }
    }).orElseThrow('Error sending email');
  }

  async notifyContributionSubmitted(contributionId: number): Promise<void> {
    return Try.execute(async () => {
      const contribution = await db.contribution.findUnique({
        where: { id: contributionId },
        include: {
          user: true,
          faculty: true,
        },
      });

      if (!contribution) return;

      const coordinators = await db.user.findMany({
        where: {
          facultyId: contribution.facultyId,
          role: { roleCode: 'COORDINATOR' },
        },
      });

      for (const coordinator of coordinators) {
        await this.createNotification({
          userId: coordinator.id,
          type: NotificationType.CONTRIBUTION_SUBMITTED,
          title: 'New Contribution Submitted',
          message: `${contribution.user.firstName} ${contribution.user.lastName} submitted "${contribution.title}"`,
          data: { contributionId },
        });

        await this.sendEmail({
          recipientId: coordinator.id,
          type: 'contribution_submitted',
          subject: `New Contribution: ${contribution.title}`,
          body: `A new contribution has been submitted by ${contribution.user.firstName} ${contribution.user.lastName} in ${contribution.faculty.facultyName}.\n\nTitle: ${contribution.title}\n\nPlease review and comment within 14 days.`,
        });
      }

      logger.info(`Notified coordinators about contribution ${contributionId}`);
    }).orElseLogWarning('Error notifying contribution submission');
  }

  async notifyGuestRegistered(guestId: number, facultyId: number): Promise<void> {
    return Try.execute(async () => {
      const guest = await db.user.findUnique({
        where: { id: guestId },
        include: { faculty: true },
      });

      if (!guest) return;

      const coordinators = await db.user.findMany({
        where: {
          facultyId,
          role: { roleCode: 'COORDINATOR' },
        },
      });

      for (const coordinator of coordinators) {
        await this.createNotification({
          userId: coordinator.id,
          type: NotificationType.GUEST_REGISTERED,
          title: 'New Guest Account Created',
          message: `Guest account created: ${guest.email}`,
          data: { guestId },
        });

        await this.sendEmail({
          recipientId: coordinator.id,
          type: 'guest_registered',
          subject: `New Guest Account: ${guest.email}`,
          body: `A new guest account has been created for ${guest.faculty?.facultyName}.\n\nEmail: ${guest.email}\nName: ${guest.firstName} ${guest.lastName}`,
        });
      }

      logger.info(`Notified coordinators about guest ${guestId}`);
    }).orElseLogWarning('Error notifying guest registration');
  }

  async notifyCommentAdded(commentId: number): Promise<void> {
    return Try.execute(async () => {
      const comment = await db.comment.findUnique({
        where: { id: commentId },
        include: {
          contribution: { include: { user: true } },
          user: true,
        },
      });

      if (!comment) return;

      const contributionOwner = comment.contribution.user;
      if (contributionOwner.id !== comment.userId) {
        await this.createNotification({
          userId: contributionOwner.id,
          type: NotificationType.COMMENT_ADDED,
          title: 'New Comment on Your Contribution',
          message: `${comment.user.firstName} ${comment.user.lastName} commented on "${comment.contribution.title}"`,
          data: { commentId, contributionId: comment.contributionId },
        });
      }

      logger.info(`Notified user about comment ${commentId}`);
    }).orElseLogWarning('Error notifying comment added');
  }

  private formatNotification(notification: any): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      isRead: notification.isRead,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      notificationAt: notification.notificationAt
        ? notification.notificationAt.toISOString()
        : null,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    };
  }
}

export default new NotificationService();
