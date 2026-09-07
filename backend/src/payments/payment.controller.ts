import { Controller, Post, Body, Get, Query, Param, UseGuards, Request, Headers, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('api/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND)
  @Post('initiate')
  async initiatePayment(@Request() req: any, @Body() body: any) {
    try {
      return this.paymentService.initiatePayment({
        amount: body.amount,
        currency: body.currency || 'USD',
        email: body.email || req.user.email,
        name: body.name || 'CampaignHub User',
        campaignTitle: body.campaignTitle || 'Campaign Payment',
        applicationId: body.applicationId,
        redirectUrl: body.redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`,
        userId: req.user.userId,
        campaignId: body.campaignId,
        payeeId: body.payeeId,
        paymentMethod: body.paymentMethod || 'flutterwave',
      });
    } catch (e: any) {
      const safeMessage =
        e?.response?.data?.message ||
        e?.message ||
        'Payment initiation failed due to a server validation error.';
      // Temporary visibility for production debugging of payment initiation flow.
      // eslint-disable-next-line no-console
      console.error('[Payments][initiate] failed', {
        actor: req?.user?.userId,
        role: req?.user?.role,
        payeeId: body?.payeeId,
        applicationId: body?.applicationId,
        campaignId: body?.campaignId,
        amount: body?.amount,
        message: safeMessage,
      });
      throw new BadRequestException(safeMessage);
    }
  }

  /** One checkout for several payees; the system records and releases each share separately. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND)
  @Post('initiate-bulk')
  async initiateBulk(
    @Request() req: any,
    @Body() body: { items: { payeeId: string; amount: number; applicationId?: string; campaignId?: string; note?: string }[]; paymentMethod?: string; redirectUrl?: string; currency?: string },
  ) {
    try {
      return await this.paymentService.initiateBulk({
        userId: req.user.brandId || req.user.userId,
        email: req.user.email,
        name: 'CampaignHub Brand',
        items: body.items,
        paymentMethod: body.paymentMethod || 'flutterwave',
        redirectUrl: body.redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/payments?payment=completed`,
        currency: body.currency || 'USD',
      });
    } catch (e: any) {
      throw new BadRequestException(e?.response?.data?.message || e?.message || 'Batch payment could not be started.');
    }
  }

  // Re-checks a payment with the provider. It writes transaction state and
  // echoes the provider's customer record, so it is not anonymous.
  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verifyPayment(@Request() req: any, @Body() body: { transactionId?: string; txRef?: string }) {
    return this.paymentService.verifyPayment(body.transactionId, body.txRef, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND)
  @Post('confirm')
  async confirmClientPayment(@Request() req: any, @Body() body: { txRef: string; transactionId?: string; status?: string }) {
    return this.paymentService.confirmClientPayment({
      userId: req.user.userId,
      txRef: body.txRef,
      transactionId: body.transactionId,
      status: body.status,
    });
  }

  /**
   * Flutterwave webhook. Unauthenticated by nature — it is called by
   * Flutterwave, not by a user — so the only thing separating a real
   * notification from a forged one is the shared hash they send in
   * `verif-hash`. Without this check anyone could POST a tx_ref with
   * `status: successful` and mint a payable payout the platform funds.
   */
  @Post('webhook')
  async handleWebhook(@Headers('verif-hash') signature: string, @Body() body: any) {
    const expected = process.env.FLW_SECRET_HASH || '';
    if (!expected) {
      console.error('[Payments] FLW_SECRET_HASH is not set — refusing to trust a webhook.');
      throw new UnauthorizedException('Webhook verification is not configured.');
    }
    const given = String(signature || '');
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }
    return this.paymentService.handleWebhook(body);
  }

  // Payment callback redirect
  @Get('callback')
  async paymentCallback(
    @Query('tx_ref') txRef: string,
    @Query('transaction_id') transactionId: string,
    @Query('status') status: string,
  ) {
    if (transactionId || txRef) {
      await this.paymentService.verifyPayment(transactionId, txRef);
    }
    // Redirect to frontend
    return { redirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?payment=${status || 'completed'}&tx_ref=${txRef || ''}` };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND)
  @Post('record-payout')
  async recordPayout(@Request() req: any, @Body() body: any) {
    return this.paymentService.createPayoutRecord({
      brandId: req.user.userId,
      creatorId: body.creatorId,
      campaignId: body.campaignId,
      amount: body.amount,
      txRef: body.txRef,
    });
  }

  @Get('config')
  getConfig() {
    return {
      publicKey: process.env.FLW_PUBLIC_KEY || '',
      paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
      telebirrEnabled: !!process.env.TELEBIRR_FABRIC_APP_ID,
    };
  }

  // Get transaction by ref
  @UseGuards(JwtAuthGuard)
  @Get('transaction/:txRef')
  async getTransaction(@Request() req: any, @Param('txRef') txRef: string) {
    return this.paymentService.getTransactionByRef(txRef, req.user.userId, req.user.role);
  }

  // Transactions (admin/finance: all; others: own payer/payee)
  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  async getTransactions(@Request() req: any) {
    return this.paymentService.getTransactionsForUser(req.user.userId, req.user.role);
  }

  // Brand escrow view (campaign-specific)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRAND)
  @Get('campaign/:campaignId/escrow')
  async getCampaignEscrow(@Request() req: any, @Param('campaignId') campaignId: string) {
    return this.paymentService.getBrandCampaignEscrow(req.user.userId, campaignId);
  }

  // ========== PAYPAL ==========
  @UseGuards(JwtAuthGuard)
  @Post('paypal/capture/:orderId')
  async capturePaypalOrder(@Request() req: any, @Param('orderId') orderId: string) {
    return this.paymentService.capturePaypalOrder(orderId, req.user);
  }

  /**
   * Telebirr posts a signed block that we cannot yet un-sign with their
   * public key, so there is no way to tell a real callback from a forged
   * one. Until that verification exists the route stays closed rather than
   * completing payments on anyone's say-so.
   */
  @Post('telebirr/webhook')
  async telebirrWebhook(@Body() body: any) {
    if (process.env.TELEBIRR_WEBHOOK_ENABLED !== 'true') {
      throw new UnauthorizedException('Telebirr callbacks are disabled until signature verification is in place.');
    }
    return this.paymentService.handleTelebirrWebhook(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('telebirr/verify/:outTradeNo')
  async verifyTelebirrPayment(@Request() req: any, @Param('outTradeNo') outTradeNo: string) {
    return this.paymentService.verifyTelebirrPayment(outTradeNo, req.user);
  }
}
