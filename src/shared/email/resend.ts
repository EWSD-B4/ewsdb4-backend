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

  async sendCommentNotificationEmail(
    to: string,
    payload: {
      studentName: string;
      coordinatorName: string;
      contributionTitle: string;
      contributionId: number;
      comment: string;
    }
  ): Promise<void> {
    if (!this.resend) {
      logger.warn(
        `Skipping comment notification email to ${to} because email client is unavailable`
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `New feedback on your contribution: ${payload.contributionTitle}`,
        html: this.getCommentNotificationTemplate(payload),
      });

      logger.info(`Comment notification email sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send comment notification email:', error);
      throw error;
    }
  }

  async sendContributionResubmittedEmail(
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
        `Skipping contribution resubmitted email to ${to} because email client is unavailable`
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `Contribution resubmitted: ${payload.contributionTitle}`,
        html: this.getContributionResubmittedTemplate(payload),
      });

      logger.info(`Contribution resubmitted email sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send contribution resubmitted email:', error);
      throw error;
    }
  }

  async sendPlagiarismAlertEmail(
    to: string,
    payload: {
      studentName: string;
      contributionTitle: string;
      contributionId: number;
      riskLevel: string;
      highestSimilarity: string;
    }
  ): Promise<void> {
    if (!this.resend) {
      logger.warn(
        `Skipping plagiarism alert email to ${to} because email client is unavailable`
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `⚠️ Plagiarism Alert: ${payload.contributionTitle}`,
        html: this.getPlagiarismAlertTemplate(payload),
      });

      logger.info(`Plagiarism alert email sent to ${to}`);
    } catch (error) {
      logger.error('Failed to send plagiarism alert email:', error);
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

  private getCommentNotificationTemplate(payload: {
    studentName: string;
    coordinatorName: string;
    contributionTitle: string;
    contributionId: number;
    comment: string;
  }): string {
    const contributionUrl = `${config.email.appUrl}/contributions/${payload.contributionId}`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Feedback on Your Contribution</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-top: 0;">New Feedback on Your Contribution</h2>

            <p>Hello ${payload.studentName},</p>

            <p><strong>${payload.coordinatorName}</strong> has provided feedback on your contribution <strong>${payload.contributionTitle}</strong>.</p>

            <div style="background-color: #fff; padding: 16px; border-left: 4px solid #3498db; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #555;"><strong>Feedback:</strong></p>
              <p style="margin: 8px 0 0 0; color: #333;">${payload.comment}</p>
            </div>

            <p>Please review the feedback and make any necessary updates to your contribution.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${contributionUrl}"
                 style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                View Contribution
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

  private getContributionResubmittedTemplate(payload: {
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
          <title>Contribution Resubmitted</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Contribution Resubmitted</h2>

            <p>Hello ${payload.coordinatorName},</p>

            <p>A student has resubmitted a contribution for <strong>${payload.facultyName}</strong>.</p>

            <div style="background-color: #fff; padding: 16px; border: 1px solid #ddd; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Student:</strong> ${payload.studentName}</p>
              <p style="margin: 0 0 8px 0;"><strong>Faculty:</strong> ${payload.facultyName}</p>
              <p style="margin: 0;"><strong>Contribution Title:</strong> ${payload.contributionTitle}</p>
            </div>

            <p>Please review the resubmitted contribution and provide feedback within the required review period.</p>

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

  private getPlagiarismAlertTemplate(payload: {
    studentName: string;
    contributionTitle: string;
    contributionId: number;
    riskLevel: string;
    highestSimilarity: string;
  }): string {
    const contributionUrl = `${config.email.appUrl}/contributions/${payload.contributionId}`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Plagiarism Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #e74c3c; margin-top: 0;">⚠️ Plagiarism Alert</h2>

            <p>Hello ${payload.studentName},</p>

            <p>Your contribution <strong>${payload.contributionTitle}</strong> has been flagged for potential plagiarism during our automated review process.</p>

            <div style="background-color: #fff3cd; padding: 16px; border-left: 4px solid #ffc107; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Risk Level:</strong> <span style="color: #e74c3c; font-weight: bold;">${payload.riskLevel}</span></p>
              <p style="margin: 0;"><strong>Highest Similarity:</strong> <span style="color: #e74c3c; font-weight: bold;">${payload.highestSimilarity}%</span></p>
            </div>

            <h3 style="color: #2c3e50;">What happens next?</h3>
            <p>Your contribution has been placed under review. You have the following options:</p>
            <ol style="color: #555;">
              <li><strong>Resubmit your contribution:</strong> You can update your contribution with proper citations and resubmit it. The plagiarism check will run again on the updated version.</li>
              <li><strong>Contact your coordinator:</strong> If you believe this is a false positive, reach out to your faculty coordinator to discuss.</li>
            </ol>

            <p style="color: #e74c3c; font-weight: bold;">Please address this issue as soon as possible to continue with the review process.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${contributionUrl}"
                 style="background-color: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                View Your Contribution
              </a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="background-color: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 3px; word-break: break-all;">
              ${contributionUrl}
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #7f8c8d;">
              This is an automated message, please do not reply to this email. Contact your faculty coordinator for assistance.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}

export default new EmailService();
