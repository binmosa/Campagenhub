import { IsString, IsOptional } from 'class-validator';

export class PitchRequestDto {
  @IsString()
  campaignName: string;

  @IsString()
  creatorName: string;

  @IsString()
  targetAudience: string;

  @IsString()
  keyPoints: string;

  @IsOptional()
  @IsString()
  tone?: string;
}
