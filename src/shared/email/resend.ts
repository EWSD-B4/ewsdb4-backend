import config from '@/config';
import logger from '@/shared/logger';
import { Resend } from 'resend';

type EmailSendPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

type EmailSendResult = {
  data: {
    id: string;
  } | null;
  error: {
    message: string;
    name?: string;
    statusCode?: number | null;
  } | null;
};

type ResendClient = {
  emails: {
    send: (payload: EmailSendPayload) => Promise<EmailSendResult>;
  };
};

type PasswordResetTemplateData = {
  resetUrl: string;
};

type WelcomeTemplateData = {
  name: string;
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
    await this.sendEmail({
      to,
      subject: 'Password Reset Request',
      html: this.buildPasswordResetTemplate({ resetUrl }),
      logContext: 'password reset',
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Welcome to EWSD',
      html: this.buildWelcomeTemplate({ name }),
      logContext: 'welcome',
    });
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    logContext: string;
  }): Promise<void> {
    if (!this.resend) {
      logger.warn(
        `Skipping ${options.logContext} email to ${options.to} because email client is unavailable`
      );
      return;
    }

    try {
      logger.info(`Preparing to send ${options.logContext} email to ${options.to}`);

      const result = await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      logger.info(
        `Resend ${options.logContext} response for ${options.to}: ${JSON.stringify(result)}`
      );

      if (result.error) {
        logger.error(
          `Resend rejected ${options.logContext} email for ${options.to}: ${JSON.stringify(result.error)}`
        );
        throw new Error(result.error.message || `Failed to send ${options.logContext} email`);
      }

      logger.info(`${options.logContext} email sent to ${options.to}`);
    } catch (error) {
      logger.error(`Failed to send ${options.logContext} email:`, error);
      throw error;
    }
  }

  private buildPasswordResetTemplate({ resetUrl }: PasswordResetTemplateData): string {
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

  async sendContributionSubmittedEmail(
    to: string,
    payload: {
      coordinatorName: string;
      studentName: string;
      facultyName: string;
      contributionTitle: string;
      contributionId: number;
    }
  ): Promise<void> {
    if (!this.resend) {
      logger.warn(
        `Skipping contribution submitted email to ${to} because email client is unavailable`
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `New contribution submitted: ${payload.contributionTitle}`,
        html: this.getContributionSubmittedTemplate(payload),
      });

      logger.info(`Contribution submission email sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send contribution submission email:', error);
      throw error;
    }
  }

  private buildWelcomeTemplate({ name }: WelcomeTemplateData): string {
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

  private getContributionSubmittedTemplate(payload: {
    coordinatorName: string;
    studentName: string;
    facultyName: string;
    contributionTitle: string;
    contributionId: number;
  }): string {
    const contributionUrl = `${config.email.appUrl}/contributions/${payload.contributionId}`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contribution Submitted</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-top: 0;">New Contribution Submitted</h2>

            <p>Hello ${payload.coordinatorName},</p>

            <p>A new student contribution has been submitted for <strong>${payload.facultyName}</strong>.</p>

            <div style="background-color: #fff; padding: 16px; border: 1px solid #ddd; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Student:</strong> ${payload.studentName}</p>
              <p style="margin: 0 0 8px 0;"><strong>Faculty:</strong> ${payload.facultyName}</p>
              <p style="margin: 0;"><strong>Contribution Title:</strong> ${payload.contributionTitle}</p>
            </div>

            <p>Please review this submission and provide feedback within the required review period.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${contributionUrl}"
                 style="background-color: #1f6feb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Review Contribution
              </a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="background-color: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 3px; word-break: break-all;">
              ${contributionUrl}
            </p>

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
