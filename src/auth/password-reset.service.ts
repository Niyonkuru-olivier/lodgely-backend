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

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      (isProduction
        ? 'https://frontend-lodgely.vercel.app'
        : 'http://localhost:3000')
    ).replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    this.logger.log(`Password reset link base: ${frontendUrl}`);

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
          <title>Reset your Lodgely password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #eef3f1;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eef3f1; padding: 28px 16px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(12, 20, 18, 0.08);">
                  <tr>
                    <td style="background-color: #0c1412; padding: 36px 28px; text-align: center;">
                      <div style="display: inline-block; width: 42px; height: 42px; line-height: 42px; border-radius: 12px; background-color: #2f8f6b; color: #ffffff; font-size: 20px; font-weight: bold;">L</div>
                      <h1 style="color: #ffffff; margin: 16px 0 0; font-size: 26px; font-weight: bold; letter-spacing: -0.02em;">Lodgely</h1>
                      <p style="color: #8eaaa0; margin: 8px 0 0; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase;">Password reset</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 36px 30px;">
                      <p style="color: #1d2b27; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                        Hello,
                      </p>
                      <p style="color: #3d524b; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                        You requested a new password for your Lodgely account. Use the button below to choose one.
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 8px 0 28px;">
                        <tr>
                          <td align="center">
                            <a href="${resetUrl}" style="display: inline-block; background-color: #2f8f6b; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-weight: bold; font-size: 15px;">
                              Set new password
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="color: #6b8178; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
                        Or paste this link into your browser:
                      </p>
                      <p style="color: #2f8f6b; font-size: 12px; line-height: 1.6; margin: 0 0 24px; word-break: break-all;">
                        ${resetUrl}
                      </p>
                      <div style="background-color: #f3f8f5; border-left: 4px solid #2f8f6b; padding: 14px 16px; border-radius: 8px;">
                        <p style="color: #3d524b; font-size: 13px; line-height: 1.6; margin: 0;">
                          <strong>Important:</strong> This link expires on ${expiryTime}.
                        </p>
                      </div>
                      <p style="color: #6b8178; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
                        If you did not request this, you can ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f7faf8; padding: 18px 30px; text-align: center; border-top: 1px solid #e4ece8;">
                      <p style="color: #8eaaa0; font-size: 12px; line-height: 1.6; margin: 0;">
                        &copy; ${year} Lodgely. Discover stays across Rwanda.
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
