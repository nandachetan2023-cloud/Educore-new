import { Test, TestingModule } from '@nestjs/testing';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { NotFoundException } from '@nestjs/common';

describe('CoursesController', () => {
  let controller: CoursesController;
  let coursesService: {
    catalog: jest.Mock;
    findBySlug: jest.Mock;
    createByInstructor: jest.Mock;
    updateByInstructor: jest.Mock;
    listByInstructor: jest.Mock;
  };

  beforeEach(async () => {
    coursesService = {
      catalog: jest.fn(),
      findBySlug: jest.fn(),
      createByInstructor: jest.fn(),
      updateByInstructor: jest.fn(),
      listByInstructor: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: coursesService }],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('catalog', () => {
    it('returns the paginated catalog for the given query', async () => {
      const query = { page: 1, perPage: 10, search: 'test', category: 'programming' };
      const result = {
        data: [{ id: 1, title: 'Test Course' }],
        meta: { page: 1, perPage: 10, total: 1, lastPage: 1 },
      };
      coursesService.catalog.mockResolvedValue(result);

      expect(await controller.catalog(query)).toEqual(result);
      expect(coursesService.catalog).toHaveBeenCalledWith(query);
    });
  });

  describe('mine', () => {
    it('lists courses owned by the instructor', async () => {
      const result = [{ id: 1, title: 'My Course' }];
      coursesService.listByInstructor.mockResolvedValue(result);

      expect(await controller.mine(1)).toEqual(result);
      expect(coursesService.listByInstructor).toHaveBeenCalledWith(1);
    });
  });

  describe('detail', () => {
    it('returns a course by slug', async () => {
      const course = {
        id: 1,
        slug: 'test-course',
        title: 'Test Course',
        averageRating: 4.5,
      };
      coursesService.findBySlug.mockResolvedValue(course);

      expect(await controller.detail('test-course')).toEqual(course);
      expect(coursesService.findBySlug).toHaveBeenCalledWith('test-course');
    });

    it('propagates NotFound from the service for unknown slugs', async () => {
      coursesService.findBySlug.mockRejectedValue(new NotFoundException('Course not found'));

      await expect(controller.detail('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a course owned by the instructor', async () => {
      const dto = { title: 'Test Course', description: 'Test description', price: 99 };
      const result = { id: 1, title: 'Test Course', slug: 'test-course', status: 'draft' };
      coursesService.createByInstructor.mockResolvedValue(result);

      expect(await controller.create(1, dto)).toEqual(result);
      expect(coursesService.createByInstructor).toHaveBeenCalledWith(1, dto);
    });
  });

  describe('update', () => {
    it('updates a course owned by the instructor', async () => {
      const dto = { title: 'Updated Course', price: 149 };
      const result = { id: 1, title: 'Updated Course', price: 149 };
      coursesService.updateByInstructor.mockResolvedValue(result);

      expect(await controller.update(1, 42, dto)).toEqual(result);
      expect(coursesService.updateByInstructor).toHaveBeenCalledWith(1, 42, dto);
    });
  });
});
