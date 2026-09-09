import { Controller, Get, Post, Body, Param, UseGuards, Request, Put, Patch, Query } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('mine')
  async getMine(@Request() req: any) {
    return this.contractsService.getMyContracts(req.user.userId);
  }

  @Patch(':id/end')
  async endContract(@Request() req: any, @Param('id') id: string) {
    return this.contractsService.endContract(req.user.userId, id);
  }

  @Post('generate')
  async generate(@Body() body: { type: string; talent_name: string; amount: number; frequency: string; currency: string }) {
    const content =
`COLLABORATION AGREEMENT

This professional collaboration agreement is entered into between the Brand and ${body.talent_name || 'the Talent'} for executing content and campaign services on the Campaign Hubz platform.

SCOPE OF WORK
The Talent agrees to create, publish, and promote content as agreed upon with the Brand. Deliverables and timelines shall be mutually confirmed prior to campaign launch.

PAYMENT TERMS
Compensation: ${body.currency || 'NGN'} ${body.amount || '[amount]'} per ${body.frequency || 'month'}.
Payment Schedule: Funds will be transferred on the agreed payment date each ${({ one_time: 'one-time milestone', daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' } as Record<string, string>)[String(body.frequency)] || 'month'} via the Campaign Hubz automated payment system.

INTELLECTUAL PROPERTY
All content created under this agreement remains the intellectual property of the Talent. The Brand is granted a non-exclusive license to use and distribute the content for the duration of this agreement.

CONFIDENTIALITY
Both parties agree to keep all campaign details, compensation terms, and proprietary information strictly confidential.

TERMINATION
Either party may terminate this agreement with 14-day written notice. All pending payments for delivered work will be honored upon termination.

GOVERNING LAW
This agreement is governed by the platform terms of Campaign Hubz and is legally binding upon digital acceptance.

Effective Date: ${new Date().toLocaleDateString()}
`;
    return { content };
  }

  /** The agreement text for the terms in the query, before the brand sends it. */
  @Get('application/:applicationId/draft')
  async draft(
    @Request() req: any,
    @Param('applicationId') applicationId: string,
    @Query('payment_amount') amount: string,
    @Query('currency') currency: string,
    @Query('payment_frequency') frequency: string,
    @Query('payment_day') day: string,
    @Query('ends_at') endsAt: string,
    @Query('notes') notes: string,
  ) {
    return this.contractsService.draftTerms(await this.contractsService.actingBrandFor(req.user, applicationId), applicationId, {
      payment_amount: Number(amount),
      currency,
      payment_frequency: frequency,
      payment_day: day ? Number(day) : null,
      ends_at: endsAt || null,
      notes,
    });
  }

  /** Brand answers a creator's counter-offer. */
  @Put('application/:applicationId/brand-respond')
  async brandRespond(@Request() req: any, @Param('applicationId') applicationId: string, @Body('action') action: 'accept_counter' | 'decline_counter') {
    return this.contractsService.brandRespond(await this.contractsService.actingBrandFor(req.user, applicationId), applicationId, action);
  }

  /** All agreements on an application: the main one first, then extra-work proposals. */
  @Get('application/:applicationId/all')
  async listForApplication(@Request() req: any, @Param('applicationId') applicationId: string) {
    return this.contractsService.listForApplication(req.user.role === 'manager' ? (await this.contractsService.actingBrandFor(req.user, applicationId)) : req.user.brandId || req.user.userId, applicationId);
  }

  /** Text preview of an extra-work addendum. */
  @Get('application/:applicationId/addendum-draft')
  async addendumDraft(
    @Request() req: any,
    @Param('applicationId') applicationId: string,
    @Query('title') title: string,
    @Query('scope') scope: string,
    @Query('tasks') tasks: string,
    @Query('payment_amount') amount: string,
    @Query('currency') currency: string,
    @Query('payment_frequency') frequency: string,
    @Query('payment_day') day: string,
    @Query('ends_at') endsAt: string,
    @Query('notes') notes: string,
  ) {
    let parsed: any = [];
    try {
      parsed = tasks ? JSON.parse(tasks) : [];
    } catch {
      parsed = [];
    }
    return this.contractsService.draftAddendum(await this.contractsService.actingBrandFor(req.user, applicationId), applicationId, {
      title,
      scope,
      tasks: parsed,
      payment_amount: Number(amount),
      currency,
      payment_frequency: frequency,
      payment_day: day ? Number(day) : null,
      ends_at: endsAt || null,
      notes,
    });
  }

  /** Brand proposes extra work on a signed agreement. */
  @Post('application/:applicationId/addendum')
  async proposeAddendum(
    @Request() req: any,
    @Param('applicationId') applicationId: string,
    @Body() body: { title: string; scope?: string | null; tasks?: any; payment_amount: number; currency: string; payment_frequency: string; payment_day?: number | null; ends_at?: string | null; notes?: string | null; terms?: string | null },
  ) {
    return this.contractsService.proposeAddendum(await this.contractsService.actingBrandFor(req.user, applicationId), applicationId, body);
  }

  @Get('application/:applicationId')
  async getContract(@Request() req: any, @Param('applicationId') applicationId: string) {
    return this.contractsService.getContractForApplication(req.user.userId, applicationId);
  }

  @Post('application/:applicationId')
  async upsertContract(
    @Request() req: any,
    @Param('applicationId') applicationId: string,
    @Body() body: { terms: string; paymentAmount: number; contractLength?: string }
  ) {
    return this.contractsService.upsertContract(await this.contractsService.actingBrandFor(req.user, applicationId), applicationId, body.terms, body.paymentAmount, body.contractLength);
  }

  /** Creator answers: `{ action: 'accept' | 'decline' | 'counter', counter?: {...}, note? }` (legacy `{ status }` still works). */
  @Put('application/:applicationId/respond')
  async respond(
    @Request() req: any,
    @Param('applicationId') applicationId: string,
    @Body() body: { action?: 'accept' | 'decline' | 'counter'; status?: string; note?: string; counter?: { payment_amount: number; currency?: string; payment_frequency?: string; payment_day?: number | null; ends_at?: string | null; note?: string | null } },
  ) {
    if (body?.action) {
      const counter = body.action === 'counter' ? body.counter : body.note ? { payment_amount: 0, note: body.note } : undefined;
      return this.contractsService.creatorRespond(req.user.userId, applicationId, body.action, counter as any);
    }
    return this.contractsService.respondToContract(req.user.userId, applicationId, String(body?.status || ''));
  }

  /** One contract (main or extra work) with both parties. */
  @Get(':contractId/detail')
  async detail(@Request() req: any, @Param('contractId') contractId: string) {
    return this.contractsService.getContractDetail(req.user.brandId || req.user.userId, contractId);
  }

  /** Creator answers a specific contract (main or extra work). */
  @Put(':contractId/respond')
  async respondOn(
    @Request() req: any,
    @Param('contractId') contractId: string,
    @Body() body: { action: 'accept' | 'decline' | 'counter'; note?: string; counter?: { payment_amount: number; currency?: string; payment_frequency?: string; payment_day?: number | null; ends_at?: string | null; note?: string | null } },
  ) {
    const counter = body.action === 'counter' ? body.counter : body.note ? { payment_amount: 0, note: body.note } : undefined;
    return this.contractsService.creatorRespondOn(req.user.userId, contractId, body.action, counter as any);
  }

  /** Brand answers a counter-offer on a specific contract. */
  @Put(':contractId/brand-respond')
  async brandRespondOn(@Request() req: any, @Param('contractId') contractId: string, @Body('action') action: 'accept_counter' | 'decline_counter') {
    return this.contractsService.brandRespondOn(req.user.brandId || req.user.userId, contractId, action);
  }
}
