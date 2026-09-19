import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard, RolesGuard, SuperAdminGuard } from './common/guards';
import { Reflector } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { CategoriesModule } from './categories/categories.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { ContentModule } from './content/content.module';
import { LearnModule } from './learn/learn.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { PayoutsModule } from './payouts/payouts.module';
import { CertificatesModule } from './certificates/certificates.module';
import { CmsModule } from './cms/cms.module';
import { BlogModule } from './blog/blog.module';
import { UploadsModule } from './uploads/uploads.module';
import { MailModule } from './mail/mail.module';
import { BrandingModule } from './branding/branding.module';
import { AdminsModule } from './admins/admins.module';
import { HealthModule } from './health/health.module';
import { PagesModule } from './pages/pages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    CoursesModule,
    CategoriesModule,
    TaxonomyModule,
    CartModule,
    OrdersModule,
    ContentModule,
    LearnModule,
    ReviewsModule,
    DashboardModule,
    AdminModule,
    PayoutsModule,
    CertificatesModule,
    CmsModule,
    BlogModule,
    UploadsModule,
    MailModule,
    BrandingModule,
    AdminsModule,
    HealthModule,
    PagesModule,
  ],
  providers: [
    // Order matters: authenticate, then rate-limit, then authorize by role.
    { provide: APP_GUARD, useFactory: (r: Reflector) => new JwtAuthGuard(r), inject: [Reflector] },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: SuperAdminGuard },
  ],
})
export class AppModule {}
