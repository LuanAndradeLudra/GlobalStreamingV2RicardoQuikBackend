import { IsBoolean, IsInt, Min, Max } from 'class-validator';

export class UpdateMonthlyWinLimitConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsInt()
  @Min(1)
  @Max(100)
  maxWinsPerMonth: number;
}
