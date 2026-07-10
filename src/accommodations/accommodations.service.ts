import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AccommodationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    search?: string;
    location?: string;
    minPrice?: string;
    maxPrice?: string;
    type?: string;
    capacity?: string;
    availableOnly?: string;
  }) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) {
        where.price.gte = parseFloat(filters.minPrice);
      }
      if (filters.maxPrice) {
        where.price.lte = parseFloat(filters.maxPrice);
      }
    }

    if (filters.type) {
      where.type = { equals: filters.type, mode: 'insensitive' };
    }

    if (filters.capacity) {
      where.capacity = { gte: parseInt(filters.capacity, 10) };
    }

    if (filters.availableOnly === 'true') {
      where.availability = true;
    }

    return this.prisma.accommodation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const accommodation = await this.prisma.accommodation.findUnique({
      where: { id },
    });
    if (!accommodation) {
      throw new NotFoundException(`Accommodation with ID ${id} not found`);
    }
    return accommodation;
  }

  async create(data: any) {
    return this.prisma.accommodation.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        price: parseFloat(data.price),
        type: data.type,
        capacity: parseInt(data.capacity, 10),
        images: data.images || [],
        amenities: data.amenities || [],
        availability: data.availability !== undefined ? data.availability : true,
      },
    });
  }

  async update(id: number, data: any) {
    await this.findOne(id); // throws if not found

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.price !== undefined) updateData.price = parseFloat(data.price);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.capacity !== undefined) updateData.capacity = parseInt(data.capacity, 10);
    if (data.images !== undefined) updateData.images = data.images;
    if (data.amenities !== undefined) updateData.amenities = data.amenities;
    if (data.availability !== undefined) updateData.availability = data.availability;

    return this.prisma.accommodation.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number) {
    await this.findOne(id); // throws if not found
    await this.prisma.accommodation.delete({ where: { id } });
    return { message: `Accommodation ${id} deleted successfully` };
  }
}
