import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentSubmission } from './content.entity';
import { Application } from '../applications/application.entity';
import { engagementsOf, isManager } from '../managers/manager-access';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(ContentSubmission)
    private contentRepo: Repository<ContentSubmission>,
    @InjectRepository(Application)
    private applicationRepo: Repository<Application>,
  ) {}

  /**
   * The two parties to an application, and nobody else: the creator who
   * signed it and the brand whose campaign it belongs to (plus a manager
   * that brand has engaged). Deliverable proof feeds payment, so an
   * outsider must not be able to read it or post to it.
   */
  private async partiesTo(applicationId: string): Promise<Application> {
    const app = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['campaign', 'campaign.brand', 'creator'],
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  private assertParty(app: Application, user: any, action: string): void {
    const brandId = (app.campaign as any)?.brand?.id;
    const creatorId = (app as any)?.creator?.id;
    if (user?.userId === creatorId) return;
    if (brandId && (user?.brandId === brandId || user?.userId === brandId)) return;
    if (isManager(user) && engagementsOf(user).some((e) => e.brandId === brandId)) return;
    throw new ForbiddenException(`You are not part of this collaboration, so you cannot ${action}.`);
  }

  async submitLink(user: any, applicationId: string, url: string): Promise<ContentSubmission> {
    const app = await this.partiesTo(applicationId);
    // Only the creator delivers work; the brand reviews it.
    if (user?.userId !== (app as any)?.creator?.id) {
      throw new ForbiddenException('Only the creator on this application can submit a link.');
    }

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

  async getSubmissions(user: any, applicationId: string): Promise<ContentSubmission[]> {
    this.assertParty(await this.partiesTo(applicationId), user, 'read these submissions');
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

  async getSubmissionsForCampaign(user: any, campaignId: string): Promise<ContentSubmission[]> {
    const owner = await this.applicationRepo.manager
      .getRepository('campaigns')
      .createQueryBuilder('c')
      .leftJoin('c.brand', 'b')
      .select('b.id', 'brandId')
      .where('c.id = :campaignId', { campaignId })
      .getRawOne<{ brandId: string }>();
    if (!owner?.brandId) throw new NotFoundException('Campaign not found');
    const mayRead =
      user?.brandId === owner.brandId ||
      user?.userId === owner.brandId ||
      (isManager(user) && engagementsOf(user).some((e) => e.brandId === owner.brandId));
    if (!mayRead) throw new ForbiddenException('This campaign is not yours.');
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
