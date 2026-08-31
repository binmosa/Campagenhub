import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Offer } from './offer.entity';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private offersRepo: Repository<Offer>,
  ) {}

  async create(userId: string, data: { title: string; description?: string; content_type: string; price: number; currency?: string; delivery_days?: number }): Promise<Offer> {
    const offer = this.offersRepo.create({
      user: { id: userId } as any,
      title: data.title,
      description: data.description || undefined,
      content_type: data.content_type,
      price: data.price,
      currency: data.currency || 'USD',
      delivery_days: data.delivery_days || 3,
    });
    return this.offersRepo.save(offer as any) as any;
  }

  async getMyOffers(userId: string): Promise<Offer[]> {
    return this.offersRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async getAllActive(): Promise<any[]> {
    const offers = await this.offersRepo.find({
      where: { is_active: true },
      relations: ['user', 'user.creatorProfile', 'user.managerProfile'],
      order: { created_at: 'DESC' },
    });

    return offers.map(o => ({
      id: o.id,
      title: o.title,
      description: o.description,
      content_type: o.content_type,
      price: o.price,
      currency: o.currency,
      delivery_days: o.delivery_days,
      created_at: o.created_at,
      user: {
        id: o.user?.id,
        email: o.user?.email,
        role: o.user?.role,
        name: o.user?.creatorProfile?.full_name || o.user?.managerProfile?.full_name || o.user?.email?.split('@')[0],
        avatar: o.user?.creatorProfile?.avatar_url || o.user?.managerProfile?.avatar_url || null,
        followers: o.user?.creatorProfile?.follower_range || null,
        location: o.user?.creatorProfile?.location || o.user?.managerProfile?.location || null,
        category: o.user?.creatorProfile?.category || o.user?.managerProfile?.specialty || null,
      },
    }));
  }

  async update(userId: string, offerId: string, data: Partial<Offer>): Promise<Offer> {
    const offer = await this.offersRepo.findOne({ where: { id: offerId }, relations: ['user'] });
    if (!offer) throw new BadRequestException('Offer not found');
    if (offer.user.id !== userId) throw new BadRequestException('Unauthorized');
    Object.assign(offer, data);
    return this.offersRepo.save(offer);
  }

  async toggleActive(userId: string, offerId: string): Promise<Offer> {
    const offer = await this.offersRepo.findOne({ where: { id: offerId }, relations: ['user'] });
    if (!offer) throw new BadRequestException('Offer not found');
    if (offer.user.id !== userId) throw new BadRequestException('Unauthorized');
    offer.is_active = !offer.is_active;
    return this.offersRepo.save(offer);
  }

  async remove(userId: string, offerId: string): Promise<void> {
    const offer = await this.offersRepo.findOne({ where: { id: offerId }, relations: ['user'] });
    if (!offer) throw new BadRequestException('Offer not found');
    if (offer.user.id !== userId) throw new BadRequestException('Unauthorized');
    await this.offersRepo.remove(offer);
  }
}
