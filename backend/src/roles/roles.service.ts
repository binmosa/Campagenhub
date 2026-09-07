import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Role } from './role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepo: Repository<Role>,
  ) {}

  async createRole(name: string, permissions: Record<string, boolean>, brandId?: string) {
    const role = this.rolesRepo.create({ name, permissions, brand_id: brandId });
    return this.rolesRepo.save(role);
  }

  async getRoleByNameAndBrand(name: string, brandId?: string) {
    if (brandId) {
      return this.rolesRepo.findOne({ where: { name, brand_id: brandId } });
    }
    return this.rolesRepo.findOne({ where: { name, brand_id: IsNull() } });
  }

  async getGlobalRoles() {
    return this.rolesRepo.createQueryBuilder('role')
      .where('role.brand_id IS NULL')
      .getMany();
  }

  async getBrandRoles(brandId: string) {
    return this.rolesRepo.find({ where: { brand_id: brandId } });
  }

  /**
   * A role is either global (platform staff, admin-owned) or a brand's own.
   * These two used to take an id and write it blind, so any signed-in user
   * could grant themselves every permission flag on their own team role —
   * jwt.strategy merges a role's permissions into the request on the next
   * call. Ownership is now proven before either write.
   */
  private async ownedRole(id: string, actor: any): Promise<Role> {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    const isAdmin = String(actor?.role || '').toLowerCase() === 'admin';
    if (!role.brand_id) {
      if (!isAdmin) throw new ForbiddenException('Only an administrator can change a platform role.');
      return role;
    }
    const actingBrand = actor?.brandId || actor?.userId;
    if (!isAdmin && role.brand_id !== actingBrand) {
      throw new ForbiddenException('That role belongs to another account.');
    }
    return role;
  }

  async updateRole(id: string, permissions: Record<string, boolean>, actor?: any) {
    await this.ownedRole(id, actor);
    await this.rolesRepo.update(id, { permissions });
    return this.rolesRepo.findOne({ where: { id } });
  }

  async deleteRole(id: string, actor?: any) {
    await this.ownedRole(id, actor);
    await this.rolesRepo.delete(id);
    return { success: true };
  }
}
