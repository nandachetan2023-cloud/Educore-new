// Mock dataset for certificate download endpoint testing
export const mockCertificateDataset = {
  user: { id: 1, name: "John Student", email: "student@mail.com", role: "student" },
  course: {
    id: 1,
    slug: "test-course-1",
    title: "Test Course 1",
    certificate: true,
    instructor: { id: 2, name: "Jane Instructor" },
  },
  enrollment: { id: 1, userId: 1, courseId: 1, haveAccess: true },
  lessons: [
    { id: 1, courseId: 1, status: true },
    { id: 2, courseId: 1, status: true },
    { id: 3, courseId: 1, status: true },
  ],
  watchHistory: [
    { userId: 1, courseId: 1, lessonId: 1, isCompleted: true },
    { userId: 1, courseId: 1, lessonId: 2, isCompleted: true },
    { userId: 1, courseId: 1, lessonId: 3, isCompleted: true },
  ],
  // Result from eligibility()
  certificateData: {
    studentName: "John Student",
    courseTitle: "Test Course 1",
    instructorName: "Jane Instructor",
  },
};
