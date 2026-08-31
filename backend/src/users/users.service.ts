import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByIdWithProfiles(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['creatorProfile', 'brandProfile', 'managerProfile'],
    });
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }

  async updateUser(id: string, data: Partial<User>): Promise<void> {
    await this.usersRepository.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async searchUsers(query: string): Promise<any[]> {
    const q = `%${query.toLowerCase()}%`;
    const users = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.creatorProfile', 'creatorProfile')
      .leftJoinAndSelect('user.brandProfile', 'brandProfile')
      .where('LOWER(user.email) LIKE :q', { q })
      .orWhere('LOWER(creatorProfile.full_name) LIKE :q', { q })
      .orWhere('LOWER(brandProfile.company_name) LIKE :q', { q })
      .take(10)
      .getMany();

    return users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      name: u.creatorProfile?.full_name || u.brandProfile?.company_name || u.email,
      avatar: u.creatorProfile?.avatar_url || u.brandProfile?.logo_url || null,
    }));
  }
}
