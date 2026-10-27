import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectedPlatform, Prisma, VipSource, VipUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RemoveVipIntegrationDto } from './dto/remove-vip-integration.dto';
import { UpsertVipIntegrationDto } from './dto/upsert-vip-integration.dto';
import { VipWebhookDto } from './dto/vip-webhook.dto';

const DEFAULT_BONUS_TICKETS = 5;

export interface VipIntegrationView {
  id: string;
  email: string | null;
  name: string | null;
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
      where: { userId, platform: ConnectedPlatform.TWITCH },
      orderBy: [{ platformUsername: 'asc' }],
    });
    return vips.map((vip) => this.toView(vip));
  }

  async upsert(userId: string, dto: UpsertVipIntegrationDto): Promise<VipIntegrationView> {
    const vip = await this.upsertRecord(this.prisma, userId, dto);
    return this.toView(vip);
  }

  async remove(userId: string, dto: RemoveVipIntegrationDto): Promise<void> {
    const vip = await this.findByUsername(this.prisma, userId, dto.platformUsername);
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
            platform: ConnectedPlatform.TWITCH,
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
      const vip = await this.findByUsername(this.prisma, userId, dto.data.platformUsername);
      if (!vip) return { ok: true, event: dto.event, removed: false };
      await this.prisma.vipUser.delete({ where: { id: vip.id } });
      return { ok: true, event: dto.event, removed: true };
    }

    const vip = await this.upsert(userId, dto.data);
    return { ok: true, event: dto.event, vip };
  }

  private async upsertRecord(
    db: Db,
    userId: string,
    dto: UpsertVipIntegrationDto,
  ): Promise<VipUser> {
    const platformUsername = dto.platformUsername.trim();
    const existing = await this.findByUsername(db, userId, platformUsername);

    const data = {
      platform: ConnectedPlatform.TWITCH,
      platformUsername,
      usernameKey: platformUsername.toLowerCase(),
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
      source: VipSource.INTEGRATION,
    };

    if (existing) {
      return db.vipUser.update({ where: { id: existing.id }, data });
    }

    return db.vipUser.create({
      data: { userId, ...data },
    });
  }

  private async findByUsername(db: Db, userId: string, platformUsername: string): Promise<VipUser | null> {
    const username = platformUsername.trim();
    if (!username) {
      throw new BadRequestException('platformUsername é obrigatório');
    }

    return db.vipUser.findFirst({
      where: {
        userId,
        platform: ConnectedPlatform.TWITCH,
        usernameKey: username.toLowerCase(),
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
      email: vip.email,
      name: vip.displayName,
      platformUsername: vip.platformUsername,
      bonusTickets: vip.bonusTickets,
      expiresAt: vip.expiresAt,
      source: vip.source,
      createdAt: vip.createdAt,
      updatedAt: vip.updatedAt,
    };
  }
}
