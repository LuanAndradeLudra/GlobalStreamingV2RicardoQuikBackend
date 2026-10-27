import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
import { IsVipExpiresAt } from '../is-vip-expires-at';

export class VipWebhookDataDto {
  @ApiPropertyOptional({ example: 'fulano@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Fulano Silva' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({
    description: 'Nick na Twitch, sem @.',
    example: 'fulano',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  platformUsername: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  bonusTickets?: number;

  @ApiPropertyOptional({ nullable: true, example: null })
  @IsOptional()
  @IsVipExpiresAt()
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
