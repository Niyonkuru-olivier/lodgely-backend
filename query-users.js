const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const connectionString = rawConnectionString.split('?')[0];

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function main() {
  console.log('--- USERS ---');
  const users = await prisma.user.findMany();
  console.log(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role })));

  console.log('\n--- PASSWORD RESET TOKENS ---');
  const tokens = await prisma.passwordResetToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(tokens);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
