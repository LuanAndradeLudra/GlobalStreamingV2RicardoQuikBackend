import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTicketGlobalRuleDto } from './create-ticket-global-rule.dto';

export class UpsertTicketGlobalRulesDto {
  @ApiProperty({
    description: 'Array of ticket global rules to create or update',
    type: [CreateTicketGlobalRuleDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketGlobalRuleDto)
  rules: CreateTicketGlobalRuleDto[];
}


