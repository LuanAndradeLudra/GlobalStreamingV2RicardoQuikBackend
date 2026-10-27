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
} from 'class-validator';

export class UpsertVipIntegrationDto {
  @ApiPropertyOptional({
    description: 'ID do VIP na ferramenta de vocês. Usado para atualizar e remover sem depender do nick.',
    example: 'art-1842',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalId?: string;

  @ApiPropertyOptional({ example: 'fulano@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Nome do VIP', example: 'Fulano Silva' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({
    enum: ['TWITCH', 'KICK'],
    description: 'Onde o nick é usado no chat. O bônus só entra no sorteio da Twitch ou da Kick.',
    example: 'TWITCH',
  })
  @IsIn(['TWITCH', 'KICK'])
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'Nick na Twitch ou na Kick, sem @. O sorteio compara esse nick com quem fala no chat.',
    example: 'fulano',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  platformUsername: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1000,
    default: 5,
    description: 'Tickets extras no sorteio. Se omitido, mantém o valor atual ou usa 5 na criação.',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  bonusTickets?: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Validade em ISO 8601. Null tira a validade. Se o campo for omitido, a data atual é mantida.',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
