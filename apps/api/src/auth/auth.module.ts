import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OAuthController } from './oauth.controller';
import { SamlController } from './saml.controller';
import { SamlService } from './saml.service';
import { JwtStrategy } from './jwt.strategy';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, PassportModule, JwtModule.register({})],
  providers: [AuthService, SamlService, JwtStrategy],
  controllers: [AuthController, OAuthController, SamlController],
  exports: [AuthService],
})
export class AuthModule {}
