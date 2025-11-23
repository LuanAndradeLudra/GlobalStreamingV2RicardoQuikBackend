import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsInt, IsOptional, Min, IsObject } from 'class-validator';
import { ConnectedPlatform, EntryMethod } from '@prisma/client';

export class CreateParticipantDto {
  @ApiProperty({
    description: 'Platform where the participant entered',
    enum: ConnectedPlatform,
    example: ConnectedPlatform.TWITCH,
  })
  @IsEnum(ConnectedPlatform)
  platform: ConnectedPlatform;

  @ApiProperty({
    description: 'External user ID from the platform',
    example: '123456789',
  })
  @IsString()
  externalUserId: string;

  @ApiProperty({
    description: 'Username on the platform',
    example: 'streamer123',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'URL of the participant avatar/photo',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({
    description: 'Entry method: how the participant earned tickets',
    enum: EntryMethod,
    example: EntryMethod.BITS,
  })
  @IsEnum(EntryMethod)
  method: EntryMethod;

  @ApiProperty({
    description: 'Number of tickets for this specific entry',
    example: 100,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  tickets: number;

  @ApiProperty({
    description: 'Optional metadata for this entry (e.g., amount of bits, specific tier, etc.)',
    example: { bitsAmount: 10000, tier: 3 },
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

