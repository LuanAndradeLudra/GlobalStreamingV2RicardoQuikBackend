import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RemoveVipIntegrationDto {
  @ApiProperty({ description: 'Nick na Twitch, sem @.', example: 'fulano' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  platformUsername: string;
}
