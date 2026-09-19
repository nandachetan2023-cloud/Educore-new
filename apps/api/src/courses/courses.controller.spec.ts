import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from './courses.service';
import { CourseController } from './courses.controller';
import { CategoriesService } from '../categories/categories.service';
import { EnrollmentService } from '../enrollments/enrollments.service';
import { ReviewsService } from '../reviews/reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('CourseController', () => {
  let controller: CourseController;
  let coursesService: CoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseController],
      providers: [
        CoursesService,
        CategoriesService,
        EnrollmentService,
        ReviewsService,
        PrismaService,
      ],
    }).compile();

    controller = module.get<CourseController>(CourseController);
    coursesService = module.get<CoursesService>(CoursesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllCourses', () => {
    it('should return all courses with pagination', async () => {
      const query = {
        page: 1,
        limit: 10,
        search: 'test',
        category: 'programming',
        instructorId: 1,
      };

      const result = {
        courses: [
          {
            id: 1,
            title: 'Test Course',
            instructorId: 1,
            categoryId: 1,
            price: 99,
            status: 'active',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      jest.spyOn(coursesService, 'getAll').mockResolvedValue(result);

      expect(await controller.getAll(query)).toEqual(result);
    });
  });

  describe('getCourse', () => {
    it('should return course by slug', async () => {
      const slug = 'test-course';
      const course = {
        id: 1,
        slug: 'test-course',
        title: 'Test Course',
        description: 'Test description',
        price: 99,
        isApproved: true,
        status: 'active',
        instructor: { id: 1, name: 'Instructor' },
        category: { id: 1, name: 'Programming' },
        reviews: [],
        totalReviews: 0,
        averageRating: 0,
      };

      jest.spyOn(coursesService, 'findBySlug').mockResolvedValue(course);

      expect(await controller.getOne(slug)).toEqual(course);
    });

    it('should throw not found exception for non-existent course', async () => {
      const slug = 'non-existent';

      jest.spyOn(coursesService, 'findBySlug').mockResolvedValue(null);

      await expect(controller.getOne(slug)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCourse', () => {
    it('should create new course', async () => {
      const createDto = {
        title: 'Test Course',
        description: 'Test description',
        price: 99,
        categoryId: 1,
      };

      const result = {
        id: 1,
        title: 'Test Course',
        slug: 'test-course',
        price: 99,
        status: 'draft',
      };

      jest.spyOn(coursesService, 'create').mockResolvedValue(result);

      expect(await controller.create(createDto)).toEqual(result);
    });
  });

  describe('updateCourse', () => {
    it('should update course', async () => {
      const id = 1;
      const updateDto = {
        title: 'Updated Course',
        price: 149,
      };

      const result = {
        id: 1,
        title: 'Updated Course',
        price: 149,
        status: 'draft',
      };

      jest.spyOn(coursesService, 'update').mockResolvedValue(result);

      expect(await controller.update(id, updateDto)).toEqual(result);
    });
  });
});