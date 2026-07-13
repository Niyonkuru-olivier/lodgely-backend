import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Request() req: any,
    @Body()
    body: {
      accommodationId: number;
      chambers: number;
      guests: number;
      checkIn: string;
      checkOut: string;
      notes?: string;
    },
  ) {
    return this.bookingsService.create(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async myBookings(@Request() req: any) {
    return this.bookingsService.findMine(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('accommodationId') accommodationId?: string,
  ) {
    return this.bookingsService.findAll({ status, accommodationId });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const booking = await this.bookingsService.findOne(id);
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      throw new ForbiddenException('Access denied');
    }
    return booking;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancelOwn(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.bookingsService.cancelOwn(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    return this.bookingsService.updateStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.remove(id);
  }
}
