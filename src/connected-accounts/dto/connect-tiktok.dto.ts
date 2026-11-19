import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ConnectTikTokDto {
  @ApiProperty({
    description: 'TikTok username of the channel that will be live. With or without @.',
    example: 'ricardoquik',
  })
  @IsString()
  @Matches(/^@?[A-Za-z0-9._]{2,24}$/, {
    message: 'username must be 2-24 characters: letters, numbers, underscore or period',
  })
  username: string;
}
