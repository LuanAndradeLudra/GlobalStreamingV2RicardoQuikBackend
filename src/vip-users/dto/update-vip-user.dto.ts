import { IsEmail, IsInt, IsDateString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateVipUserDto {
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  bonusTickets?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
