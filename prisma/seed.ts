import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@automora.com' },
    update: {},
    create: {
      email: 'admin@automora.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create manager user
  const managerPassword = await bcrypt.hash('Manager123!', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@automora.com' },
    update: {},
    create: {
      email: 'manager@automora.com',
      password: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: UserRole.MANAGER,
      isActive: true,
    },
  });
  console.log('✅ Manager user created:', manager.email);

  // Create technician user
  const techPassword = await bcrypt.hash('Tech123!', 12);
  const technician = await prisma.user.upsert({
    where: { email: 'tech@automora.com' },
    update: {},
    create: {
      email: 'tech@automora.com',
      password: techPassword,
      firstName: 'Technician',
      lastName: 'User',
      role: UserRole.TECHNICIAN,
      isActive: true,
    },
  });
  console.log('✅ Technician user created:', technician.email);

  // Create customer user
  const customerPassword = await bcrypt.hash('Customer123!', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@automora.com' },
    update: {},
    create: {
      email: 'customer@automora.com',
      password: customerPassword,
      firstName: 'Customer',
      lastName: 'User',
      role: UserRole.CUSTOMER,
      isActive: true,
    },
  });
  console.log('✅ Customer user created:', customer.email);

  console.log('\n📊 Seed Summary:');
  console.log('================');
  console.log(`Admin:     admin@automora.com / Admin123!`);
  console.log(`Manager:   manager@automora.com / Manager123!`);
  console.log(`Technician: tech@automora.com / Tech123!`);
  console.log(`Customer:  customer@automora.com / Customer123!`);
  console.log('\n✅ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
