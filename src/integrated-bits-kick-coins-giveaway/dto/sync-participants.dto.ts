import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsNotEmpty } from 'class-validator';

export class SyncIntegratedParticipantsDto {
  @ApiProperty({
    description: 'Twitch Bits leaderboard data from Twitch API',
    example: {
      data: [
        {
          user_id: '12345',
          user_login: 'johndoe',
          user_name: 'JohnDoe',
          rank: 1,
          score: 1000,
        },
      ],
    },
  })
  @IsObject()
  @IsNotEmpty()
  twitchBitsLeaderboard: {
    data: Array<{
      user_id: string;
      user_login: string;
      user_name: string;
      rank: number;
      score: number;
    }>;
  };

  @ApiProperty({
    description: 'Kick Coins leaderboard data from Kick API',
    example: {
      data: {
        lifetime: [],
        month: [],
        week: [
          {
            user_id: 67890,
            username: 'janedoe',
            gifted_amount: 5000,
            rank: 1,
          },
        ],
      },
      message: 'success',
    },
  })
  @IsObject()
  @IsNotEmpty()
  kickCoinsLeaderboard: {
    data: {
      lifetime: Array<{
        user_id: number;
        username: string;
        gifted_amount: number;
        rank: number;
      }>;
      month: Array<{
        user_id: number;
        username: string;
        gifted_amount: number;
        rank: number;
      }>;
      week: Array<{
        user_id: number;
        username: string;
        gifted_amount: number;
        rank: number;
      }>;
    };
    message: string;
  };
}










