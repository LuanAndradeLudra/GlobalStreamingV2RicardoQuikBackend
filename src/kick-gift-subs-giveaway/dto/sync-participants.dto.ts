import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, ValidateNested, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class GiftDto {
  @ApiProperty({ description: 'User ID from Kick' })
  @IsInt()
  user_id: number;

  @ApiProperty({ description: 'Username' })
  @IsString()
  username: string;

  @ApiProperty({ description: 'Quantity of gift subs' })
  @IsInt()
  quantity: number;
}

export class SyncParticipantsDto {
  @ApiProperty({ description: 'Gifts array', type: [GiftDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GiftDto)
  gifts: GiftDto[];

  @ApiProperty({ description: 'Whether gifts are enabled' })
  @IsBoolean()
  gifts_enabled: boolean;

  @ApiProperty({ description: 'Weekly gifts array', type: [GiftDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GiftDto)
  gifts_week: GiftDto[];

  @ApiProperty({ description: 'Whether weekly gifts are enabled' })
  @IsBoolean()
  gifts_week_enabled: boolean;

  @ApiProperty({ description: 'Monthly gifts array', type: [GiftDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GiftDto)
  gifts_month: GiftDto[];

  @ApiProperty({ description: 'Whether monthly gifts are enabled' })
  @IsBoolean()
  gifts_month_enabled: boolean;
}












