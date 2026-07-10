import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const rawConnectionString = process.env.DATABASE_URL;
    
    if (!rawConnectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const connectionString = rawConnectionString.split('?')[0];

    // Create a connection pool with SSL configuration
    const pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Allow self-signed certificates for Aiven
      },
    });
    
    const adapter = new PrismaPg(pool);
    
    super({
      adapter,
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
