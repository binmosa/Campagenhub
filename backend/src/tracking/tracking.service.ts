import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentSubmission } from './content.entity';
import { Application } from '../applications/application.entity';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(ContentSubmission)
    private contentRepo: Repository<ContentSubmission>,
    @InjectRepository(Application)
    private applicationRepo: Repository<Application>,
  ) {}

  async submitLink(applicationId: string, url: string): Promise<ContentSubmission> {
    const app = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['campaign'],
    });
    if (!app) throw new NotFoundException('Application not found');

    const sub = this.contentRepo.create({
      application: { id: applicationId },
      url,
      ai_verification_status: 'verifying'
    });
    const saved = await this.contentRepo.save(sub);

    // Mark for manual review (automatic content analysis is currently disabled)
    this.verifySubmission(saved.id, app.campaign.title).catch(e => console.error("Verify err", e));

    return saved;
  }

  async verifySubmission(submissionId: string, _campaignTitle: string) {
    const sub = await this.contentRepo.findOne({ where: { id: submissionId } });
    if (!sub) return;

    // Automatic URL content analysis (scraping) is temporarily disabled.
    // Submissions degrade gracefully to manual verification.
    sub.ai_verification_status = 'pending';
    sub.ai_notes = 'Automatic content analysis is currently disabled. Please verify this submission manually.';
    await this.contentRepo.save(sub);
  }

  async getSubmissions(applicationId: string): Promise<ContentSubmission[]> {
    return this.contentRepo.find({
      where: { application: { id: applicationId } },
      order: { created_at: 'DESC' },
    });
  }

  async getSubmissionsForBrand(brandId: string): Promise<ContentSubmission[]> {
    return this.contentRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.application', 'app')
      .leftJoinAndSelect('app.campaign', 'campaign')
      .leftJoinAndSelect('app.creator', 'creator')
      .leftJoinAndSelect('creator.creatorProfile', 'profile')
      .where('campaign.brand.id = :brandId', { brandId })
      .orderBy('cs.created_at', 'DESC')
      .getMany();
  }

  async getSubmissionsForCampaign(campaignId: string): Promise<ContentSubmission[]> {
    return this.contentRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.application', 'app')
      .leftJoinAndSelect('app.campaign', 'campaign')
      .leftJoinAndSelect('app.creator', 'creator')
      .leftJoinAndSelect('creator.creatorProfile', 'profile')
      .where('campaign.id = :campaignId', { campaignId })
      .orderBy('cs.created_at', 'DESC')
      .getMany();
  }
}
