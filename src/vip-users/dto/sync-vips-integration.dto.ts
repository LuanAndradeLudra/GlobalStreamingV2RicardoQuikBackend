import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray } from 'class-validator';
import { UpsertVipIntegrationDto } from './upsert-vip-integration.dto';

export class SyncVipsIntegrationDto {
  @ApiProperty({
    type: [UpsertVipIntegrationDto],
    description:
      'Lista completa dos VIPs ativos. Se algum item for inválido, nada é gravado e a resposta indica o índice. Quem foi cadastrado pela integração e não estiver nessa lista é removido. Cadastros manuais do painel permanecem.',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  vips: unknown[];
}
