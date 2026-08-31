import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/payouts')
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  async getMyPayouts(@Request() req: any) {
    return this.payoutsService.findByCreator(req.user.userId);
  }
}
