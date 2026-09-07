import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PayoutAccountsService } from './payout-accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/payout-accounts')
@UseGuards(JwtAuthGuard)
export class PayoutAccountsController {
  constructor(private readonly svc: PayoutAccountsService) {}

  @Get('mine')
  getMine(@Request() req: any) {
    return this.svc.getMine(req.user.userId);
  }

  @Post()
  save(@Request() req: any, @Body() body: any) {
    return this.svc.save(req.user.userId, body);
  }

  @Post('verify')
  verify(@Request() req: any, @Body() body: any) {
    return this.svc.verifyBankAccount(req.user.userId, body.account_number, body.bank_code, body.country);
  }

  @Get('banks/:country')
  getBanks(@Param('country') country: string) {
    return this.svc.getBanksForCountry(country);
  }

  @Get('user/:userId/status')
  async getUserBankStatus(@Request() req: any, @Param('userId') userId: string) {
    return this.svc.statusFor(req.user, userId);
  }
}
