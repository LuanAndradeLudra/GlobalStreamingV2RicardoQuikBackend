import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConnectedPlatform } from '@prisma/client';
import { IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export class RemoveVipIntegrationDto {
  @ApiPropertyOptional({
    description: 'ID do VIP na ferramenta de vocês. Obrigatório se platform e platformUsername não forem enviados.',
    example: 'art-1842',
  })
  @ValidateIf((dto: RemoveVipIntegrationDto) => !dto.platform && !dto.platformUsername)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  externalId?: string;

  @ApiPropertyOptional({ enum: ['TWITCH', 'KICK'], example: 'TWITCH' })
  @ValidateIf((dto: RemoveVipIntegrationDto) => !dto.externalId)
  @IsIn(['TWITCH', 'KICK'])
  platform?: ConnectedPlatform;

  @ApiPropertyOptional({ example: 'fulano' })
  @ValidateIf((dto: RemoveVipIntegrationDto) => !dto.externalId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  platformUsername?: string;
}
