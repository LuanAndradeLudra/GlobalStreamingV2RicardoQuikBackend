import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateParticipantDto } from './create-participant.dto';

export class CreateParticipantsBatchDto {
  @ApiProperty({
    description: 'Array of participants to add to the stream giveaway',
    type: [CreateParticipantDto],
    example: [
      {
        platform: 'TWITCH',
        externalUserId: '123456789',
        username: 'user1',
        method: 'BITS',
        tickets: 100,
        metadata: { bitsAmount: 10000 },
      },
      {
        platform: 'TWITCH',
        externalUserId: '123456789',
        username: 'user1',
        method: 'TWITCH_TIER_3',
        tickets: 20,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateParticipantDto)
  participants: CreateParticipantDto[];
}

