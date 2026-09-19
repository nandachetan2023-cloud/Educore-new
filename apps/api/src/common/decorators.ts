import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Principal } from './enums';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as accessible without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restricts a route to one or more principals (admin/instructor/student). */
export const Roles = (...roles: Principal[]) => SetMetadata(ROLES_KEY, roles);

export const SUPER_ADMIN_KEY = 'requireSuperAdmin';
/** Restricts a route to super-admins only (the top admin tier). */
export const SuperAdmin = () => SetMetadata(SUPER_ADMIN_KEY, true);

export interface AuthPrincipal {
  sub: number;
  principal: Principal;
  email: string;
  /** For admin principals: their tier. Absent for instructors/students. */
  adminRole?: 'admin' | 'super_admin';
  /** The tenant this principal belongs to. Null/absent for the platform superadmin. */
  tenantId?: number | null;
}

/** Injects the authenticated principal resolved by the JWT strategy. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthPrincipal | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthPrincipal;
    return data ? user?.[data] : user;
  },
);
