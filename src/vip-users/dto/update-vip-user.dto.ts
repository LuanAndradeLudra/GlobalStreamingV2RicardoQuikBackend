import { IsInt, IsDateString, Min, Max, IsOptional } from 'class-validator';

export class UpdateVipUserDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  bonusTickets?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
