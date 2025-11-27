import { ApiProperty } from '@nestjs/swagger';

export class DrawWinnerDto {
  @ApiProperty({ description: 'Participant ID' })
  id: string;

  @ApiProperty({ description: 'Display name in format username|method' })
  display: string;

  @ApiProperty({ description: 'Start ticket index' })
  start: number;

  @ApiProperty({ description: 'End ticket index' })
  end: number;

  @ApiProperty({ description: 'Winning ticket index' })
  index: number;
}

export class DrawResponseDto {
  @ApiProperty({ description: 'Stream giveaway ID' })
  ticket: string;

  @ApiProperty({ description: 'Total number of tickets' })
  totalTickets: number;

  @ApiProperty({ description: 'Hash algorithm used (SHA256 or MD5)' })
  listHashAlgo: string;

  @ApiProperty({ description: 'Hash of the participant list' })
  listHash: string;

  @ApiProperty({
    description: 'Draw details from Random.org',
    type: 'object',
    additionalProperties: true,
  })
  draw: {
    number: number;
    source: string;
    random: any;
    signature: string;
    verified: boolean;
  };

  @ApiProperty({ description: 'Winner information', type: DrawWinnerDto })
  winner: DrawWinnerDto;

  @ApiProperty({ description: 'Draw creation timestamp' })
  createdAt: string;
}

