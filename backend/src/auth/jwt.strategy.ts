import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Role } from '../roles/role.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { UserRole } from '../users/user.entity';

/**
 * Resolves the bearer token into `req.user`:
 *
 *   userId        the signed-in account
 *   role          from the database (a role change or ban applies at once,
 *                 not at the next login)
 *   brandId       the brand this account acts for — the parent brand for a
 *                 team member, otherwise the account itself
 *   isTeamMember  true when the account belongs to a brand's team
 *   permissions   the member's flags (custom role merged with per-user
 *                 overrides); empty for owners and non-brand roles
 *   managedBrands for account managers: the brands that engaged them, with
 *                 the grant (campaign limit, budget cap, assigned campaigns)
 *                 and the permissions each brand gave them
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    @InjectRepository(BrandTeam) private readonly teamRepo: Repository<BrandTeam>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Account no longer exists.');
    if (user.is_banned) throw new UnauthorizedException('This account has been suspended.');
    // Login blocks these, but a token issued beforehand outlives the decision
    // for up to 24h unless the state is re-checked on every request.
    if (['rejected', 'suspended'].includes(String(user.account_status || '').toLowerCase())) {
      throw new UnauthorizedException('This account is no longer active.');
    }

    const isTeamMember = !!user.parent_brand_id;
    let permissions: Record<string, boolean> = {};
    if (isTeamMember) {
      if (user.custom_role_id) {
        const role = await this.rolesRepo.findOne({ where: { id: user.custom_role_id } });
        if (role?.permissions) permissions = { ...role.permissions };
      }
      permissions = { ...permissions, ...((user.permissions as Record<string, boolean>) || {}) };
    }

    // Account managers act for the brands that engaged them — never in the open.
    let managedBrands: { brandId: string; permissions: Record<string, boolean>; grant: any }[] = [];
    if ((user.role || payload.role) === UserRole.MANAGER) {
      const rows = await this.teamRepo.find({
        where: { member: { id: payload.sub }, member_type: 'manager', is_active: true },
        relations: ['brand'],
      });
      managedBrands = rows
        .filter((r) => r.brand?.id)
        .map((r) => ({
          brandId: r.brand.id,
          permissions: (r.permissions as Record<string, boolean>) || {},
          grant: r.grant || { campaign_limit: null, budget_cap: null, campaigns: [] },
        }));
    }

    return {
      userId: payload.sub,
      email: user.email || payload.email,
      role: user.role || payload.role,
      brandId: user.parent_brand_id || payload.sub,
      isTeamMember,
      permissions,
      managedBrands,
    };
  }
}
