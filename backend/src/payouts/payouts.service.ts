import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout } from './payout.entity';

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
  ) {}

  async findAll(): Promise<Payout[]> {
    return this.payoutsRepository.find({
      relations: ['creator', 'campaign'],
      order: { created_at: 'DESC' },
    });
  }

  async findByCreator(creatorId: string): Promise<Payout[]> {
    return this.payoutsRepository.find({
      where: { creator: { id: creatorId } },
      relations: ['campaign'],
      order: { created_at: 'DESC' },
    });
  }
}
