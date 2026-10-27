import { IsEmail, IsString, IsInt, IsNotEmpty, IsOptional, Max, MaxLength, Min } from 'class-validator';
import { IsVipExpiresAt } from '../is-vip-expires-at';

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

  @IsVipExpiresAt()
  expiresAt: string;
}
