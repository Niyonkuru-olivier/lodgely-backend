import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

let prismaInstance: PrismaClient;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  constructor() {
    if (!prismaInstance) {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      const adapter = new PrismaPg(pool);
      prismaInstance = new PrismaClient({
        adapter,
        log: ['warn', 'error'],
      });
    }
  }

  async onModuleInit() {
    // Connection is automatically managed by pg Pool
  }

  async onModuleDestroy() {
    await prismaInstance.$disconnect();
  }

  get user() {
    return prismaInstance.user;
  }

  get accommodation() {
    return prismaInstance.accommodation;
  }

  get passwordResetToken() {
    return prismaInstance.passwordResetToken;
  }
}
