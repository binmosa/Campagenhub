import { Controller, Get, Post, Body, Param, UseGuards, Request, Put, Patch } from '@nestjs/common';
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

This professional collaboration agreement is entered into between the Brand and ${body.talent_name || 'the Talent'} for executing content and campaign services on the CampaignHub platform.

SCOPE OF WORK
The Talent agrees to create, publish, and promote content as agreed upon with the Brand. Deliverables and timelines shall be mutually confirmed prior to campaign launch.

PAYMENT TERMS
Compensation: ${body.currency || 'NGN'} ${body.amount || '[amount]'} per ${body.frequency || 'month'}.
Payment Schedule: Funds will be transferred on the agreed payment date each ${({ one_time: 'one-time milestone', daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' } as Record<string, string>)[String(body.frequency)] || 'month'} via the CampaignHub automated payment system.

INTELLECTUAL PROPERTY
All content created under this agreement remains the intellectual property of the Talent. The Brand is granted a non-exclusive license to use and distribute the content for the duration of this agreement.

CONFIDENTIALITY
Both parties agree to keep all campaign details, compensation terms, and proprietary information strictly confidential.

TERMINATION
Either party may terminate this agreement with 14-day written notice. All pending payments for delivered work will be honored upon termination.

GOVERNING LAW
This agreement is governed by the platform terms of CampaignHub and is legally binding upon digital acceptance.

Effective Date: ${new Date().toLocaleDateString()}
`;
    return { content };
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
    return this.contractsService.upsertContract(req.user.userId, applicationId, body.terms, body.paymentAmount, body.contractLength);
  }

  @Put('application/:applicationId/respond')
  async respond(
    @Request() req: any,
    @Param('applicationId') applicationId: string,
    @Body('status') status: string
  ) {
    return this.contractsService.respondToContract(req.user.userId, applicationId, status);
  }
}
