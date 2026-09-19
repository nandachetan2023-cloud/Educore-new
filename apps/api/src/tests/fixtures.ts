// API environment variables for testing
export const env = {
  NODE_ENV: 'test',
  API_PORT: 4000,
  API_URL: 'http://localhost:4000',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:pass@localhost:5432/test_educore',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  BRAND_NAME: 'Test EduCore',
  BRAND_LOGO: '/test-logo.svg',
  BRAND_FAVICON: '/test-favicon.ico',
  BRAND_PRIMARY_COLOR: '#4f46e5',
  BRAND_SECONDARY_COLOR: '#0ea5e9',
  DEFAULT_CURRENCY: 'USD',
  PLATFORM_COMMISSION_RATE: 20,
  STORAGE_DRIVER: 'local',
};

// Test fixtures
export const testUsers = {
  student: {
    id: 1,
    name: 'John Student',
    email: 'student@mail.com',
    role: 'student' as const,
    password: 'hashed-password',
  },
  instructor: {
    id: 2,
    name: 'Jane Instructor',
    email: 'instructor@mail.com',
    role: 'instructor' as const,
    password: 'hashed-password',
  },
};

export const testCourses = [
  {
    id: 1,
    slug: 'test-course-1',
    title: 'Test Course 1',
    instructorId: 2,
    categoryId: 1,
    price: 99,
    status: 'active' as const,
    isApproved: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    slug: 'test-course-2',
    title: 'Test Course 2',
    instructorId: 2,
    categoryId: 1,
    price: 149,
    status: 'active' as const,
    isApproved: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const testEnrollments = [
  {
    id: 1,
    userId: 1,
    courseId: 1,
    instructorId: 2,
    haveAccess: true,
    enrolledAt: new Date(),
    updatedAt: new Date(),
  },
];