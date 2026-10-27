import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RemoveVipIntegrationDto } from './dto/remove-vip-integration.dto';
import { SyncVipsIntegrationDto } from './dto/sync-vips-integration.dto';
import { UpsertVipIntegrationDto } from './dto/upsert-vip-integration.dto';
import { VipWebhookDto } from './dto/vip-webhook.dto';
import { VipApiKeyGuard } from './guards/vip-api-key.guard';
import { VipIntegrationService, VipIntegrationView } from './vip-integration.service';

@ApiTags('vip-integration')
@ApiSecurity('vip-api-key')
@Public()
@UseGuards(VipApiKeyGuard)
@Controller('integrations/vips')
export class VipIntegrationController {
  constructor(private readonly vipIntegrationService: VipIntegrationService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os VIPs do canal',
    description: 'Devolve cadastros manuais e os que chegaram pela integração.',
  })
  async list(@CurrentUser() user: User): Promise<VipIntegrationView[]> {
    return this.vipIntegrationService.list(user.id);
  }

  @Put()
  @ApiOperation({
    summary: 'Cadastra ou atualiza um VIP',
    description:
      'Se externalId já existir, atualiza esse registro. Senão, procura o mesmo nick na plataforma. Campos omitidos são mantidos. expiresAt null deixa o VIP ativo até ser removido.',
  })
  async upsert(
    @CurrentUser() user: User,
    @Body() dto: UpsertVipIntegrationDto,
  ): Promise<VipIntegrationView> {
    return this.vipIntegrationService.upsert(user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove um VIP',
    description: 'Identifique por externalId ou por platform + platformUsername.',
  })
  async remove(@CurrentUser() user: User, @Body() dto: RemoveVipIntegrationDto): Promise<void> {
    return this.vipIntegrationService.remove(user.id, dto);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Substitui os VIPs da integração pela lista enviada',
    description:
      'Útil para reconciliação. VIPs criados no painel (source MANUAL) não entram nessa limpeza, a menos que o mesmo nick seja enviado na lista.',
  })
  async sync(@CurrentUser() user: User, @Body() dto: SyncVipsIntegrationDto) {
    return this.vipIntegrationService.sync(user.id, dto.vips);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recebe aviso de VIP ativado ou desativado',
    description:
      'event vip.activated cadastra ou atualiza. event vip.deactivated remove. Remover um VIP que já não existe responde 200.',
  })
  async webhook(@CurrentUser() user: User, @Body() dto: VipWebhookDto) {
    return this.vipIntegrationService.handleWebhook(user.id, dto);
  }
}
