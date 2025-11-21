import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTicketGlobalDonationRuleDto } from './create-ticket-global-donation-rule.dto';

export class UpsertTicketGlobalDonationRulesDto {
  @ApiProperty({
    description: 'Array of ticket global donation rules to create or update',
    type: [CreateTicketGlobalDonationRuleDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketGlobalDonationRuleDto)
  donationRules: CreateTicketGlobalDonationRuleDto[];
}

