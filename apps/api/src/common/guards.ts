import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY, ROLES_KEY, SUPER_ADMIN_KEY, AuthPrincipal } from './decorators';
import { Principal } from './enums';

/**
 * Global JWT guard. Every route is protected by default; opt out with @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

/** Enforces @Roles() metadata against the authenticated principal. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Principal[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const principal = (user as AuthPrincipal)?.principal;
    if (!principal || !required.includes(principal)) {
      throw new ForbiddenException('Insufficient permissions for this resource');
    }
    return true;
  }
}

/** Enforces @SuperAdmin() — only the top admin tier may pass. */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    const u = user as AuthPrincipal;
    if (u?.principal !== Principal.ADMIN || u?.adminRole !== 'super_admin') {
      throw new ForbiddenException('This action requires super-admin privileges');
    }
    return true;
  }
}
