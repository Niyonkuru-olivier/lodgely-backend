import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  private nightsBetween(checkIn: Date, checkOut: Date): number {
    const ms = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  async create(
    userId: number,
    data: {
      accommodationId: number;
      chambers: number;
      guests: number;
      checkIn: string;
      checkOut: string;
      notes?: string;
    },
  ) {
    const accommodation = await this.prisma.accommodation.findUnique({
      where: { id: data.accommodationId },
    });
    if (!accommodation) {
      throw new NotFoundException('Accommodation not found');
    }
    if (!accommodation.availability) {
      throw new BadRequestException('This accommodation is not available for booking');
    }

    const chambers = Math.max(1, Number(data.chambers) || 1);
    const guests = Math.max(1, Number(data.guests) || 1);
    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      throw new BadRequestException('Invalid check-in or check-out date');
    }
    if (checkOut <= checkIn) {
      throw new BadRequestException('Check-out must be after check-in');
    }
    if (guests > accommodation.capacity * chambers) {
      throw new BadRequestException(
        `Guests exceed capacity (${accommodation.capacity} per chamber)`,
      );
    }

    const nights = this.nightsBetween(checkIn, checkOut);
    const totalPrice = accommodation.price * nights * chambers;

    return this.prisma.booking.create({
      data: {
        userId,
        accommodationId: data.accommodationId,
        chambers,
        guests,
        checkIn,
        checkOut,
        totalPrice,
        status: 'pending',
        notes: data.notes?.trim() || null,
      },
      include: {
        accommodation: true,
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async findMine(userId: number) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { accommodation: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(filters?: { status?: string; accommodationId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.accommodationId) {
      where.accommodationId = parseInt(filters.accommodationId, 10);
    }

    return this.prisma.booking.findMany({
      where,
      include: {
        accommodation: true,
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        accommodation: true,
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  async updateStatus(id: number, status: string) {
    const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Status must be one of: ${allowed.join(', ')}`);
    }
    await this.findOne(id);
    return this.prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        accommodation: true,
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async cancelOwn(id: number, userId: number) {
    const booking = await this.findOne(id);
    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      throw new BadRequestException(`Cannot cancel a ${booking.status} booking`);
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'cancelled' },
      include: { accommodation: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.booking.delete({ where: { id } });
    return { message: `Booking ${id} deleted successfully` };
  }
}
