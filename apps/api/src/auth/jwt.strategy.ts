import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthPrincipal } from '../common/decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  /** Whatever this returns becomes `request.user`. */
  async validate(payload: AuthPrincipal): Promise<AuthPrincipal> {
    return {
      sub: payload.sub,
      principal: payload.principal,
      email: payload.email,
      adminRole: payload.adminRole,
      tenantId: payload.tenantId,
    };
  }
}
