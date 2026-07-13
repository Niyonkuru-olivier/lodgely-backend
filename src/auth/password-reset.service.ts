import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async forgotPassword(
    email: string,
  ): Promise<{ message: string; resetLink?: string; emailSent?: boolean }> {
    const isProduction = process.env.NODE_ENV === 'production';
    const publicMessage =
      'If an account with that email exists, a password reset link has been sent.';

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      this.logger.warn(
        `Forgot-password skipped: no account found for "${email}". Email was NOT sent.`,
      );
      return { message: publicMessage };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        email,
        token: hashedToken,
        expiresAt,
      },
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    this.logger.log(`Password reset requested for ${email}`);

    let emailSent = false;

    if (!this.emailService.isConfigured()) {
      this.logger.error(
        'SMTP is not configured — reset email was not sent. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.',
      );
    } else {
      emailSent = await this.emailService.sendMail({
        to: email,
        subject: 'Reset your Lodgely password',
        html: this.buildResetEmailHtml(resetUrl, expiresAt),
        text: this.buildResetEmailText(resetUrl, expiresAt),
      });

      if (!emailSent) {
        this.logger.error(`Failed to deliver password reset email to ${email}`);
      }
    }

    // Always print the reset link in non-production so local testing never blocks on Gmail
    if (!isProduction) {
      this.logger.warn('======== DEV PASSWORD RESET LINK ========');
      this.logger.warn(resetUrl);
      this.logger.warn('=========================================');
      return {
        message: publicMessage,
        resetLink: resetUrl,
        emailSent,
      };
    }

    return { message: publicMessage, emailSent };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    if (!rawToken || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetRecord.used) {
      throw new BadRequestException('This reset link has already been used');
    }

    if (new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('Reset token has expired. Please request a new one.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { email: resetRecord.email },
      data: { password: hashedPassword },
    });

    await this.prisma.passwordResetToken.update({
      where: { token: hashedToken },
      data: { used: true },
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
  }

  private buildResetEmailHtml(resetUrl: string, expiresAt: Date): string {
    const year = new Date().getFullYear();
    const expiryTime = expiresAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Password Reset</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        Hello,
                      </p>
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        You recently requested to reset your password for your Lodgely account. Click the button below to set a new password:
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="color: #667eea; font-size: 13px; line-height: 1.6; margin: 0 0 20px; word-break: break-all;">
                        ${resetUrl}
                      </p>
                      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="color: #856404; font-size: 14px; line-height: 1.6; margin: 0;">
                          <strong>Important:</strong> This link expires on ${expiryTime}.
                        </p>
                      </div>
                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                        If you did not request a password reset, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
                      <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                        &copy; ${year} Lodgely. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private buildResetEmailText(resetUrl: string, expiresAt: Date): string {
    const expiryTime = expiresAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return `Password Reset Request

Hello,

You recently requested to reset your password for your Lodgely account.

Click the link below to reset your password:
${resetUrl}

This link expires on ${expiryTime}.

If you did not request a password reset, please ignore this email.

© ${new Date().getFullYear()} Lodgely. All rights reserved.`;
  }
}
