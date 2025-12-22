import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SyncIntegratedGiftSubsParticipantsDto {
  @ApiProperty({
    description: 'Twitch gift subs leaderboard response',
    example: { data: [{ gifter_id: '123', gifter_name: 'user', is_gift: true }] },
  })
  @IsObject()
  twitchGiftSubsLeaderboard: any;

  @ApiProperty({
    description: 'Kick gift subs leaderboard response (month data)',
    example: { gifters: [{ user_id: 123, username: 'user', quantity: 5 }] },
  })
  @IsObject()
  kickGiftSubsLeaderboard: any;
}










