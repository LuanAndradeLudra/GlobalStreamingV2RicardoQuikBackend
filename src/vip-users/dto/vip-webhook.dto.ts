import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConnectedPlatform } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class VipWebhookDataDto {
  @ApiPropertyOptional({ example: 'art-1842' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  externalId?: string;

  @ApiPropertyOptional({ example: 'fulano@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Fulano Silva' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    enum: ['TWITCH', 'KICK'],
    description: 'Obrigatório em vip.activated.',
    example: 'TWITCH',
  })
  @IsOptional()
  @IsIn(['TWITCH', 'KICK'])
  platform?: ConnectedPlatform;

  @ApiPropertyOptional({
    description: 'Nick na Twitch ou na Kick. Obrigatório em vip.activated.',
    example: 'fulano',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformUsername?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  bonusTickets?: number;

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class VipWebhookDto {
  @ApiProperty({
    enum: ['vip.activated', 'vip.deactivated'],
    description: 'vip.activated cadastra ou atualiza. vip.deactivated remove.',
    example: 'vip.activated',
  })
  @IsIn(['vip.activated', 'vip.deactivated'])
  event: 'vip.activated' | 'vip.deactivated';

  @ApiProperty({ type: VipWebhookDataDto })
  @ValidateNested()
  @Type(() => VipWebhookDataDto)
  data: VipWebhookDataDto;
}
