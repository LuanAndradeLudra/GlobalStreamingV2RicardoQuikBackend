import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { UpsertVipIntegrationDto } from './upsert-vip-integration.dto';

export class SyncVipsIntegrationDto {
  @ApiProperty({
    type: [UpsertVipIntegrationDto],
    description:
      'Lista completa dos VIPs ativos. Quem foi cadastrado pela integração e não estiver nessa lista é removido. Cadastros manuais do painel permanecem.',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => UpsertVipIntegrationDto)
  vips: UpsertVipIntegrationDto[];
}
