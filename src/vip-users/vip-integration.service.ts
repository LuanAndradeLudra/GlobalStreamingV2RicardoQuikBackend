import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectedPlatform, Prisma, VipSource, VipUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RemoveVipIntegrationDto } from './dto/remove-vip-integration.dto';
import { UpsertVipIntegrationDto } from './dto/upsert-vip-integration.dto';
import { VipWebhookDto } from './dto/vip-webhook.dto';

const DEFAULT_BONUS_TICKETS = 5;

export interface VipIntegrationView {
  id: string;
  externalId: string | null;
  email: string | null;
  name: string | null;
  platform: ConnectedPlatform;
  platformUsername: string;
  bonusTickets: number;
  expiresAt: Date | null;
  source: VipSource;
  createdAt: Date;
  updatedAt: Date;
}

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class VipIntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<VipIntegrationView[]> {
    const vips = await this.prisma.vipUser.findMany({
      where: { userId },
      orderBy: [{ platform: 'asc' }, { platformUsername: 'asc' }],
    });
    return vips.map((vip) => this.toView(vip));
  }

  async upsert(userId: string, dto: UpsertVipIntegrationDto): Promise<VipIntegrationView> {
    const vip = await this.upsertRecord(this.prisma, userId, dto);
    return this.toView(vip);
  }

  async remove(userId: string, dto: RemoveVipIntegrationDto): Promise<void> {
    const vip = await this.findByIdentity(this.prisma, userId, dto);
    if (!vip) throw new NotFoundException('VIP não encontrado');
    await this.prisma.vipUser.delete({ where: { id: vip.id } });
  }

  async sync(
    userId: string,
    vips: UpsertVipIntegrationDto[],
  ): Promise<{ synced: number; removed: number }> {
    return this.prisma.$transaction(
      async (tx) => {
        const keptIds: string[] = [];
        for (const dto of vips) {
          const saved = await this.upsertRecord(tx, userId, dto);
          keptIds.push(saved.id);
        }

        const removed = await tx.vipUser.deleteMany({
          where: {
            userId,
            source: VipSource.INTEGRATION,
            ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
          },
        });

        return { synced: vips.length, removed: removed.count };
      },
      { timeout: 30000 },
    );
  }

  async handleWebhook(userId: string, dto: VipWebhookDto): Promise<{
    ok: true;
    event: VipWebhookDto['event'];
    removed?: boolean;
    vip?: VipIntegrationView;
  }> {
    if (dto.event === 'vip.deactivated') {
      const vip = await this.findByIdentity(this.prisma, userId, dto.data);
      if (!vip) return { ok: true, event: dto.event, removed: false };
      await this.prisma.vipUser.delete({ where: { id: vip.id } });
      return { ok: true, event: dto.event, removed: true };
    }

    const platformUsername = dto.data.platformUsername?.trim();
    if (!dto.data.platform || !platformUsername) {
      throw new BadRequestException(
        'platform e platformUsername são obrigatórios para ativar um VIP. O bônus entra no sorteio pelo nick da Twitch ou da Kick.',
      );
    }

    const vip = await this.upsert(userId, {
      ...dto.data,
      platform: dto.data.platform,
      platformUsername,
    });
    return { ok: true, event: dto.event, vip };
  }

  private async upsertRecord(
    db: Db,
    userId: string,
    dto: UpsertVipIntegrationDto,
  ): Promise<VipUser> {
    const platformUsername = dto.platformUsername.trim();
    const externalId = this.clean(dto.externalId);
    const existing = await this.findForUpsert(db, userId, {
      externalId,
      platform: dto.platform,
      platformUsername,
    });

    const data = {
      platform: dto.platform,
      platformUsername,
      bonusTickets: dto.bonusTickets ?? existing?.bonusTickets ?? DEFAULT_BONUS_TICKETS,
      expiresAt:
        dto.expiresAt !== undefined
          ? dto.expiresAt
            ? new Date(dto.expiresAt)
            : null
          : existing?.expiresAt ?? null,
      email:
        dto.email !== undefined
          ? this.clean(dto.email)?.toLowerCase() ?? null
          : existing?.email ?? null,
      displayName:
        dto.name !== undefined ? this.clean(dto.name) ?? null : existing?.displayName ?? null,
      externalId: externalId ?? existing?.externalId ?? null,
      source: VipSource.INTEGRATION,
    };

    if (existing) {
      return db.vipUser.update({ where: { id: existing.id }, data });
    }

    return db.vipUser.create({
      data: { userId, ...data },
    });
  }

  private async findForUpsert(
    db: Db,
    userId: string,
    identity: { externalId?: string; platform: ConnectedPlatform; platformUsername: string },
  ): Promise<VipUser | null> {
    const byExternal = identity.externalId
      ? await db.vipUser.findFirst({ where: { userId, externalId: identity.externalId } })
      : null;
    const byUsername = await db.vipUser.findFirst({
      where: {
        userId,
        platform: identity.platform,
        platformUsername: { equals: identity.platformUsername, mode: 'insensitive' },
        ...(byExternal ? { id: { not: byExternal.id } } : {}),
      },
    });

    if (byExternal && byUsername) {
      await db.vipUser.delete({ where: { id: byUsername.id } });
    }

    return byExternal ?? byUsername;
  }

  private async findByIdentity(
    db: Db,
    userId: string,
    identity: { externalId?: string; platform?: ConnectedPlatform; platformUsername?: string },
  ): Promise<VipUser | null> {
    const externalId = this.clean(identity.externalId);
    const platformUsername = identity.platformUsername?.trim();

    if (!externalId && !(identity.platform && platformUsername)) {
      throw new BadRequestException('Informe externalId ou platform + platformUsername');
    }

    if (externalId) {
      return db.vipUser.findFirst({ where: { userId, externalId } });
    }

    return db.vipUser.findFirst({
      where: {
        userId,
        platform: identity.platform,
        platformUsername: { equals: platformUsername, mode: 'insensitive' },
      },
    });
  }

  private clean(value?: string | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private toView(vip: VipUser): VipIntegrationView {
    return {
      id: vip.id,
      externalId: vip.externalId,
      email: vip.email,
      name: vip.displayName,
      platform: vip.platform,
      platformUsername: vip.platformUsername,
      bonusTickets: vip.bonusTickets,
      expiresAt: vip.expiresAt,
      source: vip.source,
      createdAt: vip.createdAt,
      updatedAt: vip.updatedAt,
    };
  }
}
