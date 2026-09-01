import { Controller, Get } from '@nestjs/common';
import { FxService } from './fx.service';

@Controller('api/fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  /** Public daily snapshot — display-only conversions on the frontend. */
  @Get('rates')
  async getRates() {
    return this.fxService.getRates();
  }
}
