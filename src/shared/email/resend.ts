import config from '@/config';
import logger from '@/shared/logger';
import { Resend } from 'resend';

type EmailSendPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

type ResendClient = {
  emails: {
    send: (payload: EmailSendPayload) => Promise<unknown>;
  };
};

class EmailService {
  private resend: ResendClient | null;
  private readonly from: string;

  constructor() {
    this.resend = new Resend(config.email.resendApiKey) as unknown as ResendClient;
    this.from = config.email.from;
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = `${config.email.appUrl}/reset?token=${resetToken}`;

    if (!this.resend) {
      logger.warn(`Skipping password reset email to ${to} because email client is unavailable`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Password Reset Request',
        html: this.getPasswordResetTemplate(resetUrl),
      });

      logger.info(`Password reset email sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  private getPasswordResetTemplate(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Password Reset Request</h2>
            
            <p>Hello,</p>
            
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="background-color: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 3px; word-break: break-all;">
              ${resetUrl}
            </p>
            
            <p style="color: #e74c3c; font-weight: bold;">This link will expire in 1 hour.</p>
            
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #7f8c8d;">
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    if (!this.resend) {
      logger.warn(`Skipping welcome email to ${to} because email client is unavailable`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Welcome to EWSD',
        html: this.getWelcomeTemplate(name),
      });

      logger.info(`Welcome email sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  private getWelcomeTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Welcome to EWSD!</h2>
            
            <p>Hello ${name},</p>
            
            <p>Thank you for registering with EWSD. Your account has been successfully created.</p>
            
            <p>You can now log in and start using our platform.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.email.appUrl}/login" 
                 style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Go to Login
              </a>
            </div>
            
            <p>If you have any questions, feel free to contact our support team.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #7f8c8d;">
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}

export default new EmailService();
