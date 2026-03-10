export enum NotificationType {
  CONTRIBUTION_SUBMITTED = 'contribution_submitted',
  COMMENT_ADDED = 'comment_added',
  CONTRIBUTION_SELECTED = 'contribution_selected',
  CONTRIBUTION_REJECTED = 'contribution_rejected',
  GUEST_REGISTERED = 'guest_registered',
  DEADLINE_REMINDER = 'deadline_reminder',
  COMMENT_OVERDUE = 'comment_overdue',
}

export interface Notification {
  id: number;
  userId: number;
  type: string | null;
  isRead: boolean;
  title: string | null;
  message: string | null;
  data: any;
  notificationAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationRequest {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}

export interface NotificationResponse {
  id: number;
  userId: number;
  type: string | null;
  isRead: boolean;
  title: string | null;
  message: string | null;
  data: any;
  notificationAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: number;
  senderId: number | null;
  recipientId: number | null;
  type: string | null;
  subject: string | null;
  status: string | null;
  body: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendEmailRequest {
  recipientId: number;
  type: string;
  subject: string;
  body: string;
  senderId?: number;
}
