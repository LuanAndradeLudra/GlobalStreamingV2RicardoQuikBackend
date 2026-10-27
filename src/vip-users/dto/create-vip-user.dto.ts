import { IsEmail, IsString, IsInt, IsDateString, IsNotEmpty, IsOptional, Max, MaxLength, Min } from 'class-validator';

export class CreateVipUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  platformUsername: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  bonusTickets: number;

  @IsDateString()
  expiresAt: string;
}
