import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

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
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean database
  await prisma.accommodation.deleteMany({});
  await prisma.user.deleteMany({});

  // Seed admin user
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@lodgely.com',
      password: hashedAdminPassword,
      name: 'Admin',
      role: 'admin',
    },
  });
  console.log('Seeded admin user:', adminUser.email);

  // Seed default test user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const testUser = await prisma.user.create({
    data: {
      email: 'test@lodgely.com',
      password: hashedPassword,
      name: 'John Doe',
      role: 'user',
    },
  });
  console.log('Seeded test user:', testUser.email);

  // Seed accommodations
  const accommodations = [
    {
      title: 'Kigali Marriott Hotel Luxury Suite',
      description: 'Experience world-class service in the heart of Kigali. This luxury suite features beautiful views, high-speed Wi-Fi, and access to the pool and spa.',
      location: 'Kigali',
      price: 180.0,
      type: 'Hotel',
      capacity: 2,
      images: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=600'
      ],
      amenities: ['Wi-Fi', 'Pool', 'Spa', 'AC', 'Gym', 'Breakfast'],
      availability: true,
    },
    {
      title: 'Lake Kivu Serena Resort Villa',
      description: 'Beautiful villa overlooking Lake Kivu in Gisenyi. Features private balcony access, beach views, and exceptional local dining options.',
      location: 'Gisenyi',
      price: 250.0,
      type: 'Villa',
      capacity: 4,
      images: [
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=600'
      ],
      amenities: ['Wi-Fi', 'Pool', 'Beach View', 'AC', 'Kitchen', 'Barbecue'],
      availability: true,
    },
    {
      title: 'Musanze Mountain Gorilla Cabin',
      description: 'Charming wooden cabin located at the foothills of the Volcanoes National Park. Perfect base for gorilla trekking adventures.',
      location: 'Musanze',
      price: 120.0,
      type: 'Cabin',
      capacity: 2,
      images: [
        'https://images.unsplash.com/photo-1587080266227-677cd237c267?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?auto=format&fit=crop&q=80&w=600'
      ],
      amenities: ['Fireplace', 'Wi-Fi', 'Mountain View', 'Breakfast', 'Heating'],
      availability: true,
    },
    {
      title: 'Modern Kigali Heights Apartment',
      description: 'Sleek, modern 2-bedroom apartment situated in Kigali Heights. Close to restaurants, shops, and nightlife.',
      location: 'Kigali',
      price: 90.0,
      type: 'Apartment',
      capacity: 4,
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=600'
      ],
      amenities: ['Wi-Fi', 'Kitchen', 'Washing Machine', 'AC', 'Parking'],
      availability: true,
    },
    {
      title: 'Lakefront Gisenyi Retreat',
      description: 'Spacious cottage right on the shores of Lake Kivu. Includes private boat access, kayaks, and an outdoor fire pit.',
      location: 'Gisenyi',
      price: 150.0,
      type: 'Cabin',
      capacity: 6,
      images: [
        'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&q=80&w=600'
      ],
      amenities: ['Wi-Fi', 'Kitchen', 'Lake View', 'Kayaks', 'Fire Pit'],
      availability: true,
    },
    {
      title: 'Nyungwe Eco Forest Lodge',
      description: 'Immerse yourself in nature. This eco-friendly lodge is located on the edge of the ancient Nyungwe rainforest.',
      location: 'Cyangugu',
      price: 200.0,
      type: 'Hotel',
      capacity: 2,
      images: [
        'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&q=80&w=600'
      ],
      amenities: ['Forest View', 'Wi-Fi', 'Restaurant', 'Spa', 'Tours'],
      availability: false,
    }
  ];

  for (const item of accommodations) {
    await prisma.accommodation.create({
      data: item,
    });
  }

  console.log(`Successfully seeded ${accommodations.length} accommodations.`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
