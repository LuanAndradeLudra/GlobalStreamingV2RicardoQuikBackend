import { IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsVipExpiresAt } from '../is-vip-expires-at';

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
  @IsVipExpiresAt()
  expiresAt?: string | null;
}
