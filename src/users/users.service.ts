import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { normalizeEmail } from '../common/utils/email.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async create(data: { email: string; password: string; name: string; role?: string }) {
    const email = normalizeEmail(data.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'user',
      },
    });
    const { password, ...result } = user;
    return result;
  }

  async update(id: number, data: { email?: string; name?: string; role?: string; password?: string }) {
    await this.findOne(id); // throws if not found

    const updateData: any = {};
    if (data.email) updateData.email = normalizeEmail(data.email);
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });
    const { password, ...result } = user;
    return result;
  }

  async remove(id: number) {
    await this.findOne(id); // throws if not found
    await this.prisma.user.delete({ where: { id } });
    return { message: `User ${id} deleted successfully` };
  }

  async getStats() {
    const [
      totalUsers,
      totalAccommodations,
      availableAccommodations,
      totalBookings,
      pendingBookings,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.accommodation.count(),
      this.prisma.accommodation.count({ where: { availability: true } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'pending' } }),
    ]);

    const adminCount = await this.prisma.user.count({ where: { role: 'admin' } });

    return {
      totalUsers,
      adminCount,
      userCount: totalUsers - adminCount,
      totalAccommodations,
      availableAccommodations,
      unavailableAccommodations: totalAccommodations - availableAccommodations,
      totalBookings,
      pendingBookings,
    };
  }
}
