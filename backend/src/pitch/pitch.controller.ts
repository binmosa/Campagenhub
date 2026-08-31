import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { PitchRequestDto } from '../ai/pitch.dto';
import { AiService } from '../ai/ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/pitch')
export class PitchController {
  constructor(private readonly aiService: AiService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: PitchRequestDto) {
    // The AiService already has generatePitch method that expects a body with fields.
    const result = await this.aiService.generatePitch(dto);
    return result; // return the entire object to allow fetching pitches array
  }
}
