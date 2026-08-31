import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // 1. Smart Match — discover creators for a campaign
  @Get('match/:campaignId')
  async getSmartMatches(@Param('campaignId') campaignId: string) {
    return this.aiService.getSmartMatches(campaignId);
  }

  // 2. Performance Prediction
  @Get('predict/:campaignId')
  async predictPerformance(@Param('campaignId') campaignId: string) {
    return this.aiService.predictPerformance(campaignId);
  }

  // 3. Caption Generator
  @Post('captions')
  async generateCaptions(@Body() body: {
    brandName: string;
    campaignTitle: string;
    platform?: string;
    category?: string;
    tone?: string;
    count?: number;
  }) {
    return this.aiService.generateCaptions(body);
  }

  // 4. Pitch Generator (Creator-side)
  @Post('pitch')
  async generatePitch(@Body() body: {
    campaignTitle: string;
    campaignDescription?: string;
    creatorName: string;
    creatorCategory?: string;
    creatorFollowers?: string;
  }) {
    return this.aiService.generatePitch(body);
  }

  // 5. Rank Applicants (Brand-side)
  @Get('rank/:campaignId')
  async rankApplicants(@Param('campaignId') campaignId: string) {
    return this.aiService.rankApplicants(campaignId);
  }

  // 6. Contract Generator (Brand-side)
  @Post('contract')
  async generateContract(@Body() body: {
    brandName: string;
    creatorName: string;
    campaignTitle: string;
    deliverables?: string;
    budget?: number;
    deadline?: string;
    platform?: string;
    usageRights?: string;
  }) {
    return this.aiService.generateContract(body);
  }

  // 7. Campaign Recommender (Creator-side)
  @Post('recommend')
  async recommendCampaigns(@Body() body: {
    creatorCategory: string;
    creatorInterests?: string[];
    creatorFollowers?: number;
    creatorPlatform?: string;
  }) {
    return this.aiService.recommendCampaigns(body);
  }

  // 8. Sentiment Analysis
  @Post('sentiment')
  async analyzeSentiment(@Body('text') text: string) {
    return this.aiService.analyzeSentiment(text || '');
  }

  // 9. Deep Research (Visual DL)
  @Post('deep-research')
  async deepResearch(@Body() body: {
    image_url?: string;
    username?: string;
    niche?: string;
    follower_count?: string;
    platform?: string;
    known_for?: string;
  }) {
    return this.aiService.deepResearch(body);
  }

  // 10. Team Performance Summary
  @Post('team-summary')
  async teamSummary(@Body('tasks') tasks: any[]) {
    const summary = await this.aiService.generateTeamSummary(tasks || []);
    return { summary };
  }

  // 11. Analyze Post Link
  @Post('analyze-post')
  async analyzePost(@Body() body: { url: string; taskTitle: string }) {
    const analysis = await this.aiService.analyzePostLink(body.url || '', body.taskTitle || '');
    return { analysis };
  }

  // 12. Live Bot Status (proxy to Python AI engine)
  @Get('bot-status/:jobId')
  async getBotStatus(@Param('jobId') jobId: string) {
    return this.aiService.getBotStatus(jobId);
  }
}
