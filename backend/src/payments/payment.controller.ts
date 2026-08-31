import { Controller, Post, Body, Get, Query, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
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

  @Post('verify')
  async verifyPayment(@Body() body: { transactionId?: string; txRef?: string }) {
    return this.paymentService.verifyPayment(body.transactionId, body.txRef);
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

  // Flutterwave webhook (no auth — called by Flutterwave servers)
  @Post('webhook')
  async handleWebhook(@Body() body: any) {
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
  async capturePaypalOrder(@Param('orderId') orderId: string) {
    return this.paymentService.capturePaypalOrder(orderId);
  }

  // ========== TELEBIRR ==========
  @Post('telebirr/webhook')
  async telebirrWebhook(@Body() body: any) {
    return this.paymentService.handleTelebirrWebhook(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('telebirr/verify/:outTradeNo')
  async verifyTelebirrPayment(@Param('outTradeNo') outTradeNo: string) {
    return this.paymentService.verifyTelebirrPayment(outTradeNo);
  }
}
