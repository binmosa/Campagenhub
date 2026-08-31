import { Injectable, NotFoundException } from '@nestjs/common';
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

  async updateRole(id: string, permissions: Record<string, boolean>) {
    await this.rolesRepo.update(id, { permissions });
    return this.rolesRepo.findOne({ where: { id } });
  }

  async deleteRole(id: string) {
    await this.rolesRepo.delete(id);
    return { success: true };
  }
}
