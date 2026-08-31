import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/campaign.entity';
import { CreatorProfile } from '../creators/creator-profile.entity';
import { User } from '../users/user.entity';
import { Application } from '../applications/application.entity';
import { LlmService } from './llm.service';

const CATEGORIES = [
  'fashion', 'tech', 'food', 'fitness', 'beauty',
  'travel', 'gaming', 'lifestyle', 'music', 'education',
];

// ============ Template fallbacks (used when the LLM is disabled or a call fails) ============

const HOOKS: Record<string, string[]> = {
  casual: ['Hey fam! 👋', 'POV:', 'Wait, you need to see this.', 'Not sponsored by luck 🍀,', 'Okay but can we talk about', 'Hold up ✋', 'PSA:', 'Literally obsessed with'],
  professional: ['We are proud to announce', 'Setting new standards with', 'Strategic partnership alert:', 'Quality over everything.', 'Innovation meets excellence.', 'Excited to share', 'Elevating the industry standard:'],
  edgy: ["We didn't come to play. 🔥", "Everyone's sleeping on this.", 'Hot take:', 'Bold moves only.', "If you're not paying attention, you're behind.", 'Disrupting the feed.', 'No apologies needed.'],
  inspirational: ['Every great journey starts here.', 'Dream big, create bigger.', 'The future is being written right now.', 'Believe in the power of innovation.', 'When passion meets purpose, magic happens.', 'Elevate your everyday.'],
  humorous: ["My bank account after seeing this: 'Please no.'", "Scientists say you can't buy happiness. They lied.", "Told myself I didn't need anything. Clearly a lie.", 'Me pretending I discovered this before everyone else:', 'Sorry wallet, we are not friends anymore.'],
};

const BODIES = [
  '{brand} just dropped {campaign} and the {category} game will never be the same.',
  'The {campaign} initiative by {brand} is exactly what the {category} community ordered.',
  "We've partnered with {brand} for {campaign} to bring you the best in {category}.",
  "{brand}'s {campaign} is redefining what's possible in the {category} space.",
  'Exploring the incredible details of {campaign} with the amazing team at {brand}.',
  'This collaboration for {campaign} showcases why {brand} is a leader in {category}.',
  'Diving deep into the {campaign} collection, and {brand} absolutely delivered.',
  '{brand} continues to push boundaries with {campaign}.',
  'Nothing hits quite like {brand} dropping {campaign} right when we needed it.',
];

const CTAS = [
  'Trust us, you do NOT want to miss this. Link in bio! 👇',
  'Who else is obsessed? Let me know below 📣',
  'Check out the full story on their page! 🚀',
  'Hit the link in my bio to explore the magic.',
  "Don't wait—experience it yourself today! ✨",
  'Tag someone who needs to see this! 👀',
  'Drop a comment if you are as hyped as I am! 💥',
];

const PITCH_OPENERS = [
  "Hi! I'm {creator}, a passionate {category} creator reaching {followers} engaged followers. 👋",
  "Hello! My name is {creator} and I've been creating {category} content for my community of {followers}. ✨",
  "Hey there! I'm {creator}, a dedicated {category} storyteller with an amazing audience of {followers}. 🚀",
  "Greetings! I'm {creator}, and my {followers} followers rely on me for top-tier {category} recommendations. 📣",
];

const PITCH_MIDS = [
  "I'm genuinely excited about {campaign} because it aligns perfectly with the content my audience loves.",
  'What drew me to {campaign} is the strategic alignment with my content style and audience demographics.',
  'I believe {campaign} is a perfect match for my community because they are actively looking for exactly this.',
  'My creative approach blends perfectly with the goals of {campaign}, ensuring authentic and high-converting content.',
];

const PITCH_CLOSERS = [
  "I specialize in creating authentic, high-quality content that drives real engagement. I'd love to discuss how we can make this campaign a success.",
  'My average engagement rate consistently outperforms industry benchmarks, and I pride myself on delivering ROI. Let\'s connect!',
  'I bring professionalism, creativity, and a track record of successful brand collaborations. Would love to be part of this!',
  'Beyond simply posting, I focus on storytelling that actually converts viewers into customers. I look forward to your response.',
];

const PITCH_TIPS = [
  'Mention specific content ideas you have for the campaign',
  'Include links to your best performing similar content',
  "Reference the brand's recent campaigns to show you've done your research",
  'Be authentic - brands can spot generic pitches instantly',
  "Highlight your audience demographics that match the brand's target market",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

function sample<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(Campaign)
    private campaignsRepo: Repository<Campaign>,
    @InjectRepository(CreatorProfile)
    private creatorsRepo: Repository<CreatorProfile>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Application)
    private applicationsRepo: Repository<Application>,
    private llm: LlmService,
  ) {}

  /**
   * Helper: Build a standardized creator object from a CreatorProfile entity.
   * This is the single source of truth for creator data across ALL AI features.
   */
  private mapCreator(c: CreatorProfile) {
    // Parse follower_range to a number (e.g. "20,000,000" -> 20000000, "5000" -> 5000)
    let followers = 0;
    if (c.follower_range) {
      const cleaned = c.follower_range.replace(/[^0-9]/g, '');
      followers = parseInt(cleaned) || 0;
    }

    // Parse social links if available
    let socialLinks: any = {};
    if (c.social_links) {
      try { socialLinks = JSON.parse(c.social_links); } catch { socialLinks = {}; }
    }

    return {
      id: c.user?.id || c.id,
      name: c.full_name || c.username || 'Creator',
      username: c.username || '',
      email: c.user?.email || '',
      category: c.category || 'general',
      platform: socialLinks.primaryPlatform || 'Instagram',
      followers,
      engagement_rate: followers > 100000 ? 0.03 : followers > 10000 ? 0.05 : 0.08,
      content_quality: c.bio && c.bio.length > 50 ? 8.0 : c.bio && c.bio.length > 10 ? 6.5 : 4.0,
      brand_safety: 0.9,
      bio: c.bio || '',
      location: c.location || '',
      avatar: c.avatar_url || '',
      socialLinks,
    };
  }

  /** Deterministic match score used when the LLM is unavailable. */
  private heuristicMatch(creator: any, category: string, platform: string, desc: string) {
    let score = 40;
    const descWords = new Set(
      (desc || '').toLowerCase().split(/\W+/).filter((w) => w.length > 3),
    );
    const overlap = (creator.bio || '')
      .toLowerCase()
      .split(/\W+/)
      .filter((w: string) => descWords.has(w)).length;
    score += Math.min(20, overlap * 4);
    if ((creator.category || '').toLowerCase() === category.toLowerCase()) score += 30;
    if ((creator.platform || '').toLowerCase() === platform.toLowerCase()) score += 15;
    if ((creator.bio || '').length < 5) score -= 10;

    const reasons: string[] = [];
    if ((creator.category || '').toLowerCase() === category.toLowerCase()) reasons.push('Category Match');
    if ((creator.platform || '').toLowerCase() === platform.toLowerCase()) reasons.push('Platform Match');
    if (overlap >= 2) reasons.push('Strong Content Synergy');

    return { score: Math.max(5, Math.min(99, score)), reasons };
  }

  // ========== 1. SMART MATCH ==========
  async getSmartMatches(campaignId: string): Promise<any[]> {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['brand', 'brand.brandProfile'],
    });
    if (!campaign) return [];

    const allCreators = await this.creatorsRepo.find({ relations: ['user'] });
    if (allCreators.length === 0) return [];

    const realCreators = allCreators.map((c) => this.mapCreator(c));

    // Determine campaign category: use brand industry, or extract from campaign content
    let campaignCategory = campaign.brand?.brandProfile?.industry || '';
    if (!campaignCategory || campaignCategory === 'general') {
      const combined = `${campaign.title} ${campaign.description}`.toLowerCase();
      campaignCategory = [...CATEGORIES, 'sport'].find((c) => combined.includes(c)) || 'general';
    }
    const platform = campaign.platform || 'Instagram';

    const candidates = realCreators.slice(0, 50);
    const llmScores = await this.llm.chatJson<Array<{ id: string; match_score: number; match_reasons: string[] }>>(
      'You are an influencer-marketing matchmaking engine. Score how well each candidate creator fits the campaign, considering category, platform, audience size, and bio relevance. ' +
        'Respond ONLY with a JSON array covering EVERY candidate: [{"id": string, "match_score": integer 5-99, "match_reasons": array of up to 3 short strings}].',
      `Campaign: "${campaign.title}"\nDescription: ${campaign.description || ''}\nCategory: ${campaignCategory}\nPlatform: ${platform}\n\nCandidates:\n${JSON.stringify(
        candidates.map((c) => ({
          id: c.id, name: c.name, category: c.category, platform: c.platform,
          followers: c.followers, bio: (c.bio || '').slice(0, 150),
        })),
      )}`,
      { maxTokens: 3000 },
    );

    const scoreById = new Map<string, { match_score: number; match_reasons: string[] }>();
    if (Array.isArray(llmScores)) {
      for (const s of llmScores) {
        if (s && s.id != null) {
          scoreById.set(String(s.id), {
            match_score: Math.max(5, Math.min(99, Math.round(Number(s.match_score) || 0))),
            match_reasons: Array.isArray(s.match_reasons) ? s.match_reasons.slice(0, 3) : [],
          });
        }
      }
    }

    const results = candidates.map((c) => {
      const llmScore = scoreById.get(String(c.id));
      const fallback = this.heuristicMatch(c, campaignCategory, platform, campaign.description || '');
      const matchScore = llmScore?.match_score ?? fallback.score;
      const matchReasons = llmScore?.match_reasons?.length ? llmScore.match_reasons : fallback.reasons;
      return {
        id: c.id,
        name: c.name,
        username: c.username,
        email: c.email,
        category: c.category,
        platform: c.platform,
        followers: Number(c.followers).toLocaleString(),
        matchScore,
        avatar: c.avatar,
        matchReasons,
        bio: c.bio.length > 120 ? c.bio.slice(0, 120) + '...' : c.bio,
        location: c.location,
        engagementRate: c.engagement_rate,
        contentQuality: c.content_quality,
        brandSafety: c.brand_safety,
      };
    });

    return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);
  }

  // ========== 2. PREDICT PERFORMANCE ==========
  async predictPerformance(campaignId: string): Promise<any> {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['brand', 'brand.brandProfile'],
    });
    if (!campaign) return { error: 'Campaign not found' };

    const appCount = await this.applicationsRepo.count({
      where: { campaign: { id: campaignId } },
    });

    const budget = Number(campaign.budget) || 2000;
    const platform = campaign.platform || 'Instagram';
    const category = campaign.brand?.brandProfile?.industry || 'general';
    const targetAudience = campaign.target_audience || 'All';
    const isTest = (campaign.title || '').toLowerCase().includes('test') || (campaign.description || '').length < 15;

    const llmPred = await this.llm.chatJson<{
      reach: number; impressions: number; engagement_rate: string;
      estimated_roi: string; confidence: number; recommendations: string[];
    }>(
      'You are a marketing performance forecasting engine for influencer campaigns. Give realistic, conservative estimates. ' +
        'Respond ONLY with JSON: {"reach": integer, "impressions": integer, "engagement_rate": string like "4.2%", "estimated_roi": string like "2.1x", "confidence": integer 10-95, "recommendations": array of 1-3 short actionable strings}.',
      `Campaign: "${campaign.title}"\nDescription: ${campaign.description || ''}\nCategory: ${category}\nBudget: $${budget}\nPlatform: ${platform}\nTarget audience: ${targetAudience}\nApplicants so far: ${appCount}\n` +
        (isTest ? 'NOTE: this looks like a placeholder/test campaign with almost no detail — predictions must be very low with low confidence and a recommendation to add detail.' : ''),
      { maxTokens: 400 },
    );

    if (llmPred && Number(llmPred.reach) > 0) {
      return {
        campaignTitle: campaign.title,
        predictedReach: Math.round(Number(llmPred.reach)),
        predictedImpressions: Math.round(Number(llmPred.impressions) || Number(llmPred.reach) * 3),
        predictedEngagementRate: llmPred.engagement_rate || '5.0%',
        estimatedROI: llmPred.estimated_roi || '2.0x',
        confidence: Math.max(5, Math.min(95, Math.round(Number(llmPred.confidence) || 70))),
        recommendations: Array.isArray(llmPred.recommendations) ? llmPred.recommendations : [],
      };
    }

    // Deterministic fallback (no LLM)
    const platMulti: Record<string, number> = { TikTok: 3.8, YouTube: 3.2, Instagram: 3.0, Twitter: 2.6 };
    let reach = Math.max(500, Math.round(budget * 45));
    let eng = Math.max(50, Math.round(reach * 0.06));
    let confidence = 75;
    const recommendations: string[] = [];

    if (isTest) {
      reach = Math.round(reach * 0.15);
      eng = Math.round(eng * 0.05);
      confidence = 22;
      recommendations.push('[WARNING] Your campaign lacks detail. Add a comprehensive title and description for accurate predictions.');
    } else {
      if (targetAudience.length > 10 && targetAudience.toLowerCase() !== 'all') eng = Math.round(eng * 1.3);
      if (budget < 2000) recommendations.push('Consider increasing budget for broader reach. Campaigns under $2K typically see lower volume.');
    }
    if (['fashion', 'beauty'].includes(category)) {
      recommendations.push(`Visual-heavy formats (Reels/TikTok) deliver highest engagement for ${category}.`);
    }
    if (reach > 50000) {
      recommendations.push('Strong reach potential. Consider micro-influencers for localized impact alongside main campaign.');
    }

    const engRate = Math.min(15, Math.max(0.5, (eng / Math.max(reach, 1)) * 100));
    return {
      campaignTitle: campaign.title,
      predictedReach: reach,
      predictedImpressions: Math.round(reach * (platMulti[platform] ?? 3.0)),
      predictedEngagementRate: `${engRate.toFixed(1)}%`,
      estimatedROI: `${Math.min(10, Math.max(0.1, (eng / Math.max(budget, 1)) * 10)).toFixed(1)}x`,
      confidence,
      recommendations,
    };
  }

  // ========== 3. GENERATE CAPTIONS ==========
  async generateCaptions(body: any): Promise<any> {
    const brandName = body.brandName || '';
    const campaignTitle = body.campaignTitle || '';
    const tone = body.tone || 'professional';
    const count = Number(body.count) || 3;
    const category = CATEGORIES.includes(body.category) ? body.category : 'lifestyle';

    const toneDesc: Record<string, string> = {
      casual: 'fun, relatable, and conversational',
      professional: 'polished, authoritative, and trustworthy',
      edgy: 'bold, provocative, and attention-grabbing',
      inspirational: 'uplifting, motivational, and aspirational',
      humorous: 'funny, witty, and entertaining',
    };

    let captions: string[] = [];
    let source = 'template';

    const llmResult = await this.llm.chatJson<{ captions: string[] }>(
      'You are an expert social media marketing copywriter. Write engaging, authentic captions for brand campaigns. ' +
        'Keep captions concise (2-3 sentences max). Include relevant emojis and a call-to-action. Do NOT include hashtags in the caption itself. ' +
        'Respond ONLY with JSON: {"captions": array of strings}.',
      `Write ${count} unique ${toneDesc[tone] || 'professional'} ${body.platform || 'Instagram'} captions for ${brandName || 'the brand'}'s '${campaignTitle || 'new campaign'}' campaign in the ${category} niche.`,
      { maxTokens: 800, temperature: 0.8 },
    );

    if (llmResult && Array.isArray(llmResult.captions)) {
      captions = llmResult.captions.filter((c) => typeof c === 'string' && c.length > 20).slice(0, count);
      if (captions.length > 0) source = 'llm';
    }

    while (captions.length < count) {
      const hook = pick(HOOKS[tone in HOOKS ? tone : 'casual']);
      const bodyText = fill(pick(BODIES), { brand: brandName || 'the brand', campaign: campaignTitle || 'this campaign', category });
      const caption = `${hook} ${bodyText} ${pick(CTAS)}`;
      if (!captions.includes(caption)) captions.push(caption);
    }

    const hashtags = [
      `#${category}`,
      `#${(brandName || 'brand').replace(/ /g, '')}`,
      `#${(campaignTitle || 'campaign').replace(/ /g, '')}`,
      '#ad',
      '#sponsored',
    ];

    return {
      captions: captions.slice(0, count),
      hashtags,
      category: category.charAt(0).toUpperCase() + category.slice(1),
      confidence: source === 'llm' ? 92 : 78,
      source,
    };
  }

  // ========== 4. GENERATE PITCH ==========
  async generatePitch(body: any): Promise<any> {
    const campaignTitle = body.campaignName || body.campaignTitle || '';
    const tone = body.tone || 'Professional';
    let pitches: string[] = [];
    let source = 'template';

    const llmResult = await this.llm.chatJson<{ pitches: string[] }>(
      `You are an expert at writing influencer pitch messages. Write compelling, ${tone} pitches from a content creator to a brand. ` +
        'Keep each concise (3-4 sentences), authentic, and highlight specific value. ' +
        'Respond ONLY with JSON: {"pitches": array of 3 unique strings}.',
      `Write 3 unique pitches from ${body.creatorName || 'a creator'} (category: ${body.creatorCategory || 'influencer'}) for the campaign: '${campaignTitle}'.\n` +
        `Target Audience: ${body.targetAudience || 'General'}\n` +
        `Key Points to include: ${body.keyPoints || 'Alignment with brand values'}\n` +
        `Campaign context: ${body.campaignDescription || 'Marketing collaboration'}.`,
      { maxTokens: 900, temperature: 0.8 },
    );

    if (llmResult && Array.isArray(llmResult.pitches)) {
      pitches = llmResult.pitches.filter((p) => typeof p === 'string' && p.length > 30).slice(0, 3);
      if (pitches.length > 0) source = 'llm';
    }

    while (pitches.length < 3) {
      const opener = fill(pick(PITCH_OPENERS), {
        creator: body.creatorName || 'a creator',
        category: body.creatorCategory || 'lifestyle',
        followers: body.creatorFollowers || '10K',
      });
      const mid = fill(pick(PITCH_MIDS), { campaign: campaignTitle || 'this campaign' });
      const pitch = `${opener} ${mid} ${pick(PITCH_CLOSERS)}`;
      if (!pitches.includes(pitch)) pitches.push(pitch);
    }

    return {
      pitches: pitches.slice(0, 3),
      tips: sample(PITCH_TIPS, 3),
      source,
    };
  }

  // ========== 5. RANK APPLICANTS ==========
  async rankApplicants(campaignId: string): Promise<any> {
    const campaign = await this.campaignsRepo.findOne({
      where: { id: campaignId },
      relations: ['brand', 'brand.brandProfile'],
    });
    if (!campaign) return { ranked_applicants: [] };

    const applications = await this.applicationsRepo.find({
      where: { campaign: { id: campaignId } },
      relations: ['creator', 'creator.creatorProfile'],
    });
    if (applications.length === 0) return { ranked_applicants: [] };

    const campaignCategory = campaign.brand?.brandProfile?.industry || 'general';
    const campaignPlatform = campaign.platform || 'Instagram';

    const applicants = applications.map((app) => {
      const profile = app.creator?.creatorProfile;
      const mapped = profile ? this.mapCreator(profile) : null;
      return {
        id: app.id,
        creator_user_id: app.creator?.id || '',
        name: mapped?.name || profile?.full_name || profile?.username || app.creator?.email || 'Unknown',
        avatar: mapped?.avatar || '',
        email: app.creator?.email || '',
        followers: mapped?.followers || 5000,
        engagement_rate: mapped?.engagement_rate || 0.05,
        content_quality: mapped?.content_quality || 5.0,
        category: mapped?.category || 'general',
        platform: mapped?.platform || 'Instagram',
        bio: mapped?.bio || '',
        pitch: app.pitch || '',
        status: app.status || 'pending',
      };
    });

    const llmRanks = await this.llm.chatJson<Array<{
      applicant_id: string; qualification_score: number; recommended: boolean;
      confidence: number; strengths: string[]; concerns: string[];
    }>>(
      'You are an applicant-ranking engine for influencer campaigns. Score each applicant on fit for the campaign (category/platform alignment, audience size, engagement, bio quality, pitch quality). ' +
        'Respond ONLY with a JSON array covering EVERY applicant: [{"applicant_id": string, "qualification_score": number 5-99, "recommended": boolean, "confidence": number 10-99, "strengths": array of short strings, "concerns": array of short strings}].',
      `Campaign: "${campaign.title}" — category: ${campaignCategory}, platform: ${campaignPlatform}\n\nApplicants:\n${JSON.stringify(
        applicants.map((a) => ({
          applicant_id: a.id, name: a.name, category: a.category, platform: a.platform,
          followers: a.followers, engagement_rate: a.engagement_rate,
          bio: a.bio.slice(0, 120), pitch: a.pitch.slice(0, 200),
        })),
      )}`,
      { maxTokens: 3000 },
    );

    const rankById = new Map<string, any>();
    if (Array.isArray(llmRanks)) {
      for (const r of llmRanks) if (r && r.applicant_id != null) rankById.set(String(r.applicant_id), r);
    }

    const ranked = applicants.map((a) => {
      const r = rankById.get(String(a.id));
      // Deterministic fallback scoring
      const catMatch = a.category.toLowerCase() === campaignCategory.toLowerCase();
      const platMatch = a.platform.toLowerCase() === campaignPlatform.toLowerCase();
      let fallbackScore = 45;
      if (catMatch) fallbackScore += 20;
      if (platMatch) fallbackScore += 10;
      if (a.engagement_rate > 0.05) fallbackScore += 10;
      if (a.followers > 50000) fallbackScore += 5;
      if (a.pitch.length > 50) fallbackScore += 5;

      const strengths: string[] = [];
      if (catMatch) strengths.push('Category aligned');
      if (platMatch) strengths.push('Platform match');
      if (a.engagement_rate > 0.05) strengths.push('High engagement');
      const concerns: string[] = [];
      if (!catMatch) concerns.push('Category mismatch');
      if (!platMatch) concerns.push('Platform mismatch');

      const score = Math.max(5, Math.min(99, Math.round(Number(r?.qualification_score) || fallbackScore)));
      return {
        applicant_id: a.id,
        creator_user_id: a.creator_user_id,
        name: a.name,
        avatar: a.avatar,
        email: a.email,
        bio: a.bio,
        category: a.category,
        platform: a.platform,
        followers: a.followers,
        pitch: a.pitch,
        qualification_score: score,
        recommended: typeof r?.recommended === 'boolean' ? r.recommended : score > 55,
        confidence: Math.max(10, Math.min(99, Math.round(Number(r?.confidence) || 60))),
        strengths: Array.isArray(r?.strengths) && r.strengths.length ? r.strengths : (strengths.length ? strengths : ['General Audience Reach']),
        concerns: Array.isArray(r?.concerns) && r.concerns.length ? r.concerns : (concerns.length ? concerns : ['No major concerns']),
      };
    });

    ranked.sort((a, b) => b.qualification_score - a.qualification_score);
    return { ranked_applicants: ranked };
  }

  // ========== 6. GENERATE CONTRACT ==========
  async generateContract(body: any): Promise<any> {
    const brandName = body.brandName || '';
    const creatorName = body.creatorName || '';
    const campaignTitle = body.campaignTitle || '';
    const deliverables = body.deliverables || '';
    const budget = Number(body.budget) || 0;
    const deadline = body.deadline || '';
    const platform = body.platform || 'Instagram';
    const usageRights = body.usageRights || '30 days';
    const budgetStr = budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let contractText = '';
    let source = 'template';

    const result = await this.llm.chat(
      'You are an expert legal document writer specializing in international influencer marketing contracts. ' +
        'Write a standard, globally applicable contract agreement between a brand and a content creator. ' +
        'IMPORTANT RESTRAINTS: Do NOT reference specific countries, states, or regional jurisdictions. ' +
        "Keep the jurisdiction strictly generalized as 'applicable local law'. " +
        'Include standard sections: scope of work, compensation, timeline, usage rights, confidentiality, and termination.',
      `Write an influencer marketing contract between ${brandName} (Brand) and ${creatorName} (Creator) for the '${campaignTitle}' campaign.\n` +
        `Platform: ${platform}\nDeliverables: ${deliverables || 'To be agreed upon'}\nCompensation: $${budgetStr}\n` +
        `Deadline: ${deadline || 'To be agreed upon'}\nUsage Rights: ${usageRights}\nGenerate a complete, professional contract.`,
      { maxTokens: 1500 },
    );

    if (result && result.length > 100) {
      contractText = result;
      source = 'llm';
    } else {
      contractText = `INFLUENCER MARKETING AGREEMENT

This Agreement is entered into between:

BRAND: ${brandName} (hereinafter "Brand")
CREATOR: ${creatorName} (hereinafter "Creator")

1. CAMPAIGN OVERVIEW
Campaign Name: ${campaignTitle}
Platform: ${platform}
Campaign Period: From the date of signing through ${deadline || 'completion of deliverables'}

2. SCOPE OF WORK
The Creator agrees to produce and publish the following content:
${deliverables || '- Content as mutually agreed upon between Brand and Creator'}

3. COMPENSATION
Total Fee: $${budgetStr} USD
Payment Schedule:
  - 50% upon signing this agreement
  - 50% upon completion and approval of all deliverables

4. CONTENT REQUIREMENTS
- All content must be original and created specifically for this campaign
- Content must include proper disclosure (e.g., #ad, #sponsored) per FTC guidelines
- Brand must approve all content before publication

5. USAGE RIGHTS
The Brand is granted a license to use, reproduce, and distribute the Creator's content for a period of ${usageRights} from publication date.

6. TIMELINE
- Content drafts due: 5 business days before publication date
- Publication deadline: ${deadline || 'As mutually agreed'}

7. CONFIDENTIALITY
Both parties agree to maintain confidentiality.

8. TERMINATION
Either party may terminate with 14 days written notice.

SIGNATURES:

Brand: ____________________  Date: ________
${brandName}

Creator: ____________________  Date: ________
${creatorName}`;
    }

    return {
      contract: contractText,
      source,
      sections: ['Campaign Overview', 'Scope of Work', 'Compensation',
        'Content Requirements', 'Usage Rights', 'Timeline',
        'Confidentiality', 'Termination'],
    };
  }

  // ========== 7. RECOMMEND CAMPAIGNS ==========
  async recommendCampaigns(body: any): Promise<any> {
    const creatorCategory = body.creatorCategory || 'lifestyle';
    const creatorPlatform = body.creatorPlatform || 'Instagram';
    const creatorInterests: string[] = body.creatorInterests || [];

    const allCampaigns = await this.campaignsRepo.find({
      where: { status: 'active' },
      relations: ['brand', 'brand.brandProfile'],
    });

    const realCampaigns = allCampaigns.map((c) => ({
      id: c.id,
      title: c.title || '',
      description: c.description || '',
      category: c.brand?.brandProfile?.industry || 'general',
      budget: Number(c.budget) || 0,
      platform: c.platform || 'Instagram',
    }));
    if (realCampaigns.length === 0) return { recommendations: [] };

    const llmRecs = await this.llm.chatJson<Array<{ campaign_id: string; match_score: number; why: string }>>(
      'You are a campaign recommendation engine for content creators. Score how well each campaign fits the creator. ' +
        'Respond ONLY with a JSON array covering EVERY campaign: [{"campaign_id": string, "match_score": integer 5-99, "why": one short sentence}].',
      `Creator profile — category: ${creatorCategory}, platform: ${creatorPlatform}, followers: ${body.creatorFollowers || 10000}, interests: ${creatorInterests.join(', ') || 'none listed'}\n\nCampaigns:\n${JSON.stringify(
        realCampaigns.map((c) => ({
          campaign_id: c.id, title: c.title, category: c.category,
          platform: c.platform, budget: c.budget, description: c.description.slice(0, 150),
        })),
      )}`,
      { maxTokens: 2000 },
    );

    const recById = new Map<string, { match_score: number; why: string }>();
    if (Array.isArray(llmRecs)) {
      for (const r of llmRecs) if (r && r.campaign_id != null) recById.set(String(r.campaign_id), r);
    }

    const interestWords = new Set(
      [creatorCategory, ...creatorInterests].join(' ').toLowerCase().split(/\W+/).filter((w) => w.length > 3),
    );

    const recommendations = realCampaigns.map((camp) => {
      const llmRec = recById.get(String(camp.id));
      // Deterministic fallback
      let base = 30;
      const campText = `${camp.category} ${camp.title} ${camp.description}`.toLowerCase();
      const overlap = campText.split(/\W+/).filter((w) => interestWords.has(w)).length;
      base += Math.min(30, overlap * 6);
      if (camp.category.toLowerCase() === creatorCategory.toLowerCase()) base += 25;
      if (camp.platform.toLowerCase() === creatorPlatform.toLowerCase()) base += 10;
      if (camp.budget > 500) base += 4;

      const matchScore = llmRec ? Math.max(5, Math.min(99, Math.round(Number(llmRec.match_score) || 0))) : Math.min(99, Math.max(5, base));
      const why = llmRec?.why || `This campaign aligns with your ${creatorCategory} profile${overlap >= 2 ? ' and has strong synergy with your expressed interests.' : '.'}`;

      return {
        campaign_id: camp.id,
        title: camp.title || 'Unknown Campaign',
        category: camp.category,
        match_score: matchScore,
        budget_range: `$${camp.budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        platform: camp.platform,
        why,
      };
    });

    recommendations.sort((a, b) => b.match_score - a.match_score);
    return { recommendations: recommendations.slice(0, 8) };
  }

  // ========== 8. SENTIMENT (Simple) ==========
  async analyzeSentiment(text: string): Promise<any> {
    const positive = ['great', 'amazing', 'love', 'excellent', 'perfect', 'awesome', 'fantastic'];
    const negative = ['bad', 'terrible', 'hate', 'awful', 'horrible', 'worst', 'disappointed'];
    const lower = text.toLowerCase();
    const posCount = positive.filter((w) => lower.includes(w)).length;
    const negCount = negative.filter((w) => lower.includes(w)).length;

    if (posCount > negCount) return { score: 1, label: 'positive', display: 'Positive' };
    if (negCount > posCount) return { score: -1, label: 'negative', display: 'Negative' };
    return { score: 0, label: 'neutral', display: 'Neutral' };
  }

  // ========== 9. DEEP RESEARCH ==========
  async deepResearch(body: any): Promise<any> {
    const username = (body.username && body.username !== 'unknown' ? body.username : '') || '';
    const niche = (body.niche || '').trim();
    const knownFor = (body.known_for || '').trim();

    // Defaults (used when the LLM is unavailable)
    let age = pick(['18-24', '25-34', '35-44', '45-54']);
    let gender = pick(['Female', 'Female', 'Male', 'Non-binary / Other']);
    let tags: string[] = ['Content Creator'];
    let isSafe = true;
    let mlConfidence = 80;

    const parsed = await this.llm.chatJson<{
      tags: string[]; age: string; gender: string; brand_safe: boolean; confidence: number;
    }>(
      'You are an AI profiler assigning aesthetics and demographics to social media profiles. ' +
        "Output ONLY valid JSON containing 'tags' (list of 3 strings), 'age' (string, e.g. '25-34'), 'gender' (string), 'brand_safe' (boolean), and 'confidence' (integer between 60 and 99).",
      `Profile to analyze: username: ${username}. niche: ${niche}. known for: ${knownFor}. Provide the JSON.`,
      { maxTokens: 300 },
    );

    if (parsed) {
      if (Array.isArray(parsed.tags)) tags = parsed.tags;
      if (parsed.age) age = String(parsed.age);
      if (parsed.gender) gender = String(parsed.gender);
      if (typeof parsed.brand_safe === 'boolean') isSafe = parsed.brand_safe;
      if (parsed.confidence) mlConfidence = Math.max(60, Math.min(99, Math.round(Number(parsed.confidence))));
    } else if (niche) {
      tags.push(niche);
    }

    const safetyScore = isSafe
      ? 88 + Math.floor(Math.random() * 12)
      : 30 + Math.floor(Math.random() * 45);

    return {
      success: true,
      image_url: body.image_url || '',
      username_analyzed: body.username || '',
      analysis: {
        demographics_estimated: {
          age_group: age,
          gender_presentation: gender,
        },
        aesthetic_tags: [...new Set(tags)],
        recommended_platforms: [...new Set([body.platform || 'Instagram'])],
        visual_brand_safety: {
          score: safetyScore,
          flags: isSafe ? 'None' : 'Flagged content detected by LLM.',
          is_brand_safe: isSafe,
        },
      },
      // Web discovery requires a search/scraping provider, which is currently disabled.
      discovered_creators: [],
      ml_confidence: mlConfidence,
    };
  }

  // ========== 10. TEAM PERFORMANCE SUMMARY ==========
  async generateTeamSummary(tasks: any[]): Promise<string> {
    const byUser: Record<string, { name: string; total: number; completed: number; pending: number; links: string[] }> = {};
    for (const t of tasks) {
      const name = t.assignedTo?.email?.split('@')[0] || 'Unknown';
      const uid = t.assignedTo?.id || 'unknown';
      if (!byUser[uid]) byUser[uid] = { name, total: 0, completed: 0, pending: 0, links: [] };
      byUser[uid].total++;
      if (t.status === 'completed' || t.status === 'reviewed') byUser[uid].completed++;
      else byUser[uid].pending++;
      if (t.post_link) byUser[uid].links.push(t.post_link);
    }

    const result = await this.llm.chat(
      'You are a professional campaign manager AI. Provide concise, clear, and actionable feedback.',
      `Analyze the following team performance data and provide a concise executive summary with actionable insights:\n\n${Object.values(byUser)
        .map((u) => `• ${u.name}: ${u.completed}/${u.total} tasks completed, ${u.pending} pending, ${u.links.length} posts submitted`)
        .join('\n')}\n\nProvide: 1) Overall team health rating (A-F), 2) Top performer, 3) Areas needing attention, 4) Recommendations. Keep it under 200 words.`,
      { maxTokens: 400 },
    );

    return result || 'Unable to generate team summary — AI is not configured.';
  }

  // ========== 11. ANALYZE POST LINK ==========
  async analyzePostLink(url: string, taskTitle: string): Promise<string> {
    const cleanUrl = url ? url.trim().replace(/[\n\r]/g, '') : '';
    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      return '⚠️ Analysis skipped: Invalid or missing post URL.';
    }

    let platform = 'Unknown';
    if (cleanUrl.includes('instagram.com')) platform = 'Instagram';
    else if (cleanUrl.includes('tiktok.com')) platform = 'TikTok';
    else if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) platform = 'YouTube';
    else if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) platform = 'Twitter/X';
    else if (cleanUrl.includes('facebook.com')) platform = 'Facebook';

    // Live metric scraping is disabled; provide an LLM sanity check of the link when available.
    const result = await this.llm.chat(
      'You are a social media campaign assistant. Be concise.',
      `A creator submitted this post link for the task "${taskTitle}": ${cleanUrl}. The detected platform is ${platform}. ` +
        'In 2-3 sentences: confirm whether the URL format looks like a valid post link for that platform, and note that metrics must be verified manually.',
      { maxTokens: 200 },
    );

    if (result) {
      return `🤖 AI Report — Platform: ${platform}\n📝 ${result}\nℹ️ Automatic metric scraping is currently disabled — please verify metrics manually.`;
    }
    return `🤖 Platform detected: ${platform}.\nℹ️ Automatic post analysis is currently disabled — please verify this submission manually.`;
  }

  // ========== 12. LIVE BOT STATUS ==========
  async getBotStatus(jobId: string): Promise<any> {
    // The scraping bot has been removed; there are no live analysis jobs.
    return { job_id: jobId, status: 'not_found' };
  }
}
