import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import * as express from 'express';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { UPLOAD_ROOT } from './uploads/uploads.module';

async function bootstrap() {
  // rawBody is needed so Stripe webhook signatures can be verified.
  const app = await NestFactory.create(AppModule, { cors: false, rawBody: true });
  const config = app.get(ConfigService);

  // Serve uploaded files. crossOriginResourcePolicy is relaxed so the web app
  // (different origin) can load images/media from the API.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use('/uploads', express.static(UPLOAD_ROOT));
  app.enableCors({
    origin: config.get<string>('webUrl'),
    credentials: true,
  });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  if (config.get('env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EduCore API')
      .setDescription('White-label LMS / course marketplace API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, doc);
  }

  const port = config.get<number>('port')!;
  await app.listen(port);
  Logger.log(`API ready on http://localhost:${port}/api`, 'Bootstrap');
}
bootstrap();
