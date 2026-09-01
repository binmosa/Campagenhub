import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { MARKETS } from './markets.config';

/** Public, read-only market registry for the frontend. */
@Controller('api/markets')
export class MarketsController {
  @Get()
  getMarkets() {
    return MARKETS;
  }

  @Get(':code')
  getMarket(@Param('code') code: string) {
    const market = MARKETS.find((m) => m.code === code.toLowerCase());
    if (!market) throw new NotFoundException('Unknown market');
    return market;
  }
}
