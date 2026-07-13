import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { normalizeEmail } from '../common/utils/email.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: any) {
    const email = normalizeEmail(data.email);

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: data.name || '',
        role: data.role || 'user',
      },
    });

    const { password, ...result } = user;
    return result;
  }

  async login(data: any) {
    const email = normalizeEmail(data.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const { password, ...userWithoutPassword } = user;

    return {
      access_token: this.jwtService.sign(payload),
      user: userWithoutPassword,
    };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const { password, ...result } = user;
    return result;
  }

  async updateProfile(
    userId: number,
    data: { name?: string; email?: string; currentPassword?: string; newPassword?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const updateData: { name?: string; email?: string; password?: string } = {};

    if (data.name !== undefined && data.name.trim()) {
      updateData.name = data.name.trim();
    }

    if (data.email !== undefined && data.email.trim()) {
      const email = normalizeEmail(data.email);
      if (email !== user.email) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) {
          throw new ConflictException('Email already registered');
        }
        updateData.email = email;
      }
    }

    if (data.newPassword) {
      if (!data.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }
      if (data.newPassword.length < 6) {
        throw new BadRequestException('New password must be at least 6 characters');
      }
      const match = await bcrypt.compare(data.currentPassword, user.password);
      if (!match) {
        throw new BadRequestException('Current password is incorrect');
      }
      updateData.password = await bcrypt.hash(data.newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No changes provided');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    const { password, ...result } = updated;
    return result;
  }
}
