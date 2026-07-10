import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordResetService {
  constructor(private prisma: PrismaService) {}

  async forgotPassword(email: string): Promise<{ message: string; devToken?: string }> {
    // Always return success message to prevent email enumeration attacks
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal that the email doesn't exist
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    // Invalidate any existing tokens for this email
    await this.prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        email,
        token: hashedToken,
        expiresAt,
      },
    });

    // In production, send email here. In dev, log the reset link to console.
    const resetUrl = `http://localhost:3000/reset-password?token=${rawToken}`;

    console.log('\n========================================');
    console.log('🔑  PASSWORD RESET LINK (DEV MODE)');
    console.log('========================================');
    console.log(`User: ${email}`);
    console.log(`Link: ${resetUrl}`);
    console.log(`Expires: ${expiresAt.toISOString()}`);
    console.log('========================================\n');

    return {
      message: 'If that email exists, a reset link has been sent.',
      // In dev mode only — remove this in production
      devToken: rawToken,
    };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    if (!rawToken || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    // Hash the incoming token to compare with stored hash
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

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await this.prisma.user.update({
      where: { email: resetRecord.email },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await this.prisma.passwordResetToken.update({
      where: { token: hashedToken },
      data: { used: true },
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
  }
}
