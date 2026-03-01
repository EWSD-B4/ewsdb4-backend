import { db } from '../dist/shared/database';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const isProduction = process.env.NODE_ENV === 'production';

async function seedRolesAndFaculties() {
  const roles = await Promise.all([
    db.role.upsert({
      where: { id: 1 },
      update: {
        roleName: 'Administrator',
        roleCode: 'ADMIN',
        description: 'Super User',
        requiresFaculty: false,
        isActive: true,
      },
      create: {
        id: 1,
        roleName: 'Administrator',
        roleCode: 'ADMIN',
        description: 'Super User',
        requiresFaculty: false,
        isActive: true,
      },
    }),
    db.role.upsert({
      where: { id: 2 },
      update: {
        roleName: 'Student',
        roleCode: 'STUDENT',
        description: 'Student user',
        requiresFaculty: true,
        isActive: true,
      },
      create: {
        id: 2,
        roleName: 'Student',
        roleCode: 'STUDENT',
        description: 'Student user',
        requiresFaculty: true,
        isActive: true,
      },
    }),
    db.role.upsert({
      where: { id: 3 },
      update: {
        roleName: 'Marketing Coordinator',
        roleCode: 'COORDINATOR',
        description: 'Faculty marketing coordinator',
        requiresFaculty: true,
        isActive: true,
      },
      create: {
        id: 3,
        roleName: 'Marketing Coordinator',
        roleCode: 'COORDINATOR',
        description: 'Faculty marketing coordinator',
        requiresFaculty: true,
        isActive: true,
      },
    }),
    db.role.upsert({
      where: { id: 4 },
      update: {
        roleName: 'Marketing Manager',
        roleCode: 'MANAGER',
        description: 'Marketing manager role',
        requiresFaculty: false,
        isActive: true,
      },
      create: {
        id: 4,
        roleName: 'Marketing Manager',
        roleCode: 'MANAGER',
        description: 'Marketing manager role',
        requiresFaculty: false,
        isActive: true,
      },
    }),
    db.role.upsert({
      where: { id: 5 },
      update: {
        roleName: 'Guest',
        roleCode: 'GUEST',
        description: 'Guest user with limited access',
        requiresFaculty: false,
        isActive: true,
      },
      create: {
        id: 5,
        roleName: 'Guest',
        roleCode: 'GUEST',
        description: 'Guest user with limited access',
        requiresFaculty: false,
        isActive: true,
      },
    }),
  ]);

  const faculties = await Promise.all([
    db.faculty.upsert({
      where: { id: 1 },
      update: {
        facultyName: 'Computer Science',
        facultyCode: 'CS',
        description: 'Faculty of Computer Science',
        isActive: true,
      },
      create: {
        id: 1,
        facultyName: 'Computer Science',
        facultyCode: 'CS',
        description: 'Faculty of Computer Science',
        isActive: true,
      },
    }),
    db.faculty.upsert({
      where: { id: 2 },
      update: {
        facultyName: 'Engineering',
        facultyCode: 'ENG',
        description: 'Faculty of Engineering',
        isActive: true,
      },
      create: {
        id: 2,
        facultyName: 'Engineering',
        facultyCode: 'ENG',
        description: 'Faculty of Engineering',
        isActive: true,
      },
    }),
    db.faculty.upsert({
      where: { id: 3 },
      update: {
        facultyName: 'Business',
        facultyCode: 'BUS',
        description: 'Faculty of Business',
        isActive: true,
      },
      create: {
        id: 3,
        facultyName: 'Business',
        facultyCode: 'BUS',
        description: 'Faculty of Business',
        isActive: true,
      },
    }),
  ]);

  return { roles, faculties };
}

async function seedAdminUser() {
  const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);

  return db.user.upsert({
    where: { email: 'admin@ewsd.edu' },
    update: {
      passwordHash: adminPassword,
      roleId: 1,
      facultyId: null,
      isActive: true,
    },
    create: {
      email: 'admin@ewsd.edu',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      roleId: 1,
      facultyId: null,
      isActive: true,
    },
  });
}

async function main() {
  console.log(`Starting seed in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

  const { roles, faculties } = await seedRolesAndFaculties();
  const adminUser = await seedAdminUser();

  console.log(`Roles seeded: ${roles.length}`);
  console.log(`Faculties seeded: ${faculties.length}`);
  console.log(`Admin user: ${adminUser.email}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
