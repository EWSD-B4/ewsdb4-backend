import { db } from '../src/shared/database';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const isProduction = process.env.NODE_ENV === 'production';

async function main() {
  console.log(`🌱 Starting database seed (${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'})...`);

  // ============================================
  // ALWAYS CREATE: Roles (needed in all environments)
  // ============================================
  console.log('📝 Creating roles...');
  const roles = await Promise.all([
    db.role.upsert({
      where: { roleCode: 'ADMIN' },
      update: {},
      create: {
        roleName: 'Administrator',
        roleCode: 'ADMIN',
        description: 'System administrator with full access',
        requiresFaculty: false,
        isActive: true,
      },
    }),
    db.role.upsert({
      where: { roleCode: 'MANAGER' },
      update: {},
      create: {
        roleName: 'Marketing Manager',
        roleCode: 'MANAGER',
        description: 'Marketing manager role',
        requiresFaculty: false,
        isActive: true,
      },
    }),
    db.role.upsert({
      where: { roleCode: 'COORDINATOR' },
      update: {},
      create: {
        roleName: 'Marketing Coordinator',
        roleCode: 'COORDINATOR',
        description: 'Faculty marketing coordinator',
        requiresFaculty: true,
        isActive: true,
      },
    }),
    db.role.upsert({
      where: { roleCode: 'STUDENT' },
      update: {},
      create: {
        roleName: 'Student',
        roleCode: 'STUDENT',
        description: 'Student user',
        requiresFaculty: true,
        isActive: true,
      },
    }),
    db.role.upsert({
      where: { roleCode: 'GUEST' },
      update: {},
      create: {
        roleName: 'Guest',
        roleCode: 'GUEST',
        description: 'Guest user with limited access',
        requiresFaculty: false,
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${roles.length} roles`);

  // ============================================
  // ALWAYS CREATE: Admin User (needed in all environments)
  // ============================================
  console.log('👤 Creating admin user...');
  const adminRole = roles.find((r) => r.roleCode === 'ADMIN');
  
  if (!adminRole) {
    throw new Error('Admin role not found');
  }

  const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);

  const adminUser = await db.user.upsert({
    where: { email: 'admin@ewsd.edu' },
    update: {},
    create: {
      email: 'admin@ewsd.edu',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      roleId: adminRole.id,
      facultyId: null,
      isActive: true,
    },
  });

  console.log(`✅ Admin user created: ${adminUser.email}`);

  // ============================================
  // DEVELOPMENT ONLY: Test Data
  // ============================================
  let faculties: any[] = [];
  let academicYear: any = null;
  let terms: any = null;

  if (!isProduction) {
    console.log('\n📦 Creating development test data...\n');

    // Create Faculties
    console.log('📝 Creating faculties...');
    faculties = await Promise.all([
      db.faculty.upsert({
        where: { facultyCode: 'CS' },
        update: {},
        create: {
          facultyName: 'Computer Science',
          facultyCode: 'CS',
          description: 'Faculty of Computer Science',
          isActive: true,
        },
      }),
      db.faculty.upsert({
        where: { facultyCode: 'BUS' },
        update: {},
        create: {
          facultyName: 'Business',
          facultyCode: 'BUS',
          description: 'Faculty of Business',
          isActive: true,
        },
      }),
      db.faculty.upsert({
        where: { facultyCode: 'ENG' },
        update: {},
        create: {
          facultyName: 'Engineering',
          facultyCode: 'ENG',
          description: 'Faculty of Engineering',
          isActive: true,
        },
      }),
    ]);

    console.log(`✅ Created ${faculties.length} faculties`);

    // Create Academic Year
    console.log('📅 Creating academic year...');
    academicYear = await db.academicYear.upsert({
      where: { yearName: '2025-2026' },
      update: {},
      create: {
        yearName: '2025-2026',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-06-30'),
        closureDate: new Date('2026-03-14'),
        closureFinalDate: new Date('2026-04-14'),
        isCurrent: true,
        isActive: true,
      },
    });

    console.log(`✅ Academic year created: ${academicYear.yearName}`);

    // Create Terms & Conditions
    console.log('📜 Creating terms and conditions...');
    terms = await db.termsCondition.upsert({
      where: { version: '1.0' },
      update: {},
      create: {
        version: '1.0',
        content: `
# Terms and Conditions for Student Contributions

## 1. Acceptance of Terms
By submitting a contribution, you agree to these terms and conditions.

## 2. Intellectual Property
- You retain ownership of your submitted work
- You grant the university a non-exclusive license to use your work for educational purposes

## 3. Content Guidelines
- All submissions must be original work
- Plagiarism is strictly prohibited
- Content must be appropriate and respectful

## 4. Privacy
- Your personal information will be handled according to university privacy policies
- Your submissions may be reviewed by faculty coordinators and managers

## 5. Deadlines
- Submissions must be made before the closure date
- Late submissions may not be accepted

By clicking "I Agree", you acknowledge that you have read and agree to these terms.
        `.trim(),
        effectiveDate: new Date('2025-01-01'),
        isActive: true,
      },
    });

    console.log(`✅ Terms and conditions created: v${terms.version}`);
  }

  // ============================================
  // Summary
  // ============================================
  console.log('\n🎉 Database seeding completed successfully!\n');
  console.log('📋 Summary:');
  console.log(`   Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`   Roles: ${roles.length}`);
  console.log(`   Admin User: ${adminUser.email}`);
  console.log(`   Admin Password: Admin@123`);
  
  if (!isProduction) {
    console.log(`   Faculties: ${faculties.length}`);
    console.log(`   Academic Year: ${academicYear?.yearName || 'N/A'}`);
    console.log(`   Terms Version: ${terms?.version || 'N/A'}`);
  }
  
  console.log('\n⚠️  IMPORTANT: Change the admin password after first login!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
