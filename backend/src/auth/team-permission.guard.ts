import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Team-member permissions.
 *
 * A brand can add people to its account (users with `parent_brand_id`).
 * They sign in with their own credentials but act for the parent brand —
 * `req.user.brandId` resolves to the owner (see JwtStrategy). What they may
 * do is the owner's call: a flat map of flags on the user (or on their
 * custom role), edited from Profile → People on this account.
 *
 *   @TeamPermission('can_add_campaigns')   // members need the flag
 *   @TeamPermission('owner')               // members never allowed
 *
 * Owners (no parent) and every non-brand role pass untouched.
 */
export const TEAM_PERMISSION_KEY = 'teamPermission';
export const TeamPermission = (permission: string) => SetMetadata(TEAM_PERMISSION_KEY, permission);

export const TEAM_PERMISSION_LABELS: Record<string, string> = {
  can_add_campaigns: 'create and edit campaigns',
  can_manage_applications: 'manage applications',
  can_view_analytics: 'view analytics',
};

@Injectable()
export class TeamPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(TEAM_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (!user.isTeamMember) return true;
    if (required === 'owner') {
      throw new ForbiddenException('Only the brand owner can do this.');
    }
    if (user.permissions?.[required]) return true;
    const label = TEAM_PERMISSION_LABELS[required] || required;
    throw new ForbiddenException(`Your team account is not allowed to ${label}. Ask the brand owner to grant "${required}".`);
  }
}
