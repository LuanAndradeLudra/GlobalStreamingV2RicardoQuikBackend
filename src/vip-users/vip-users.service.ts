import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VipUser, ConnectedPlatform } from '@prisma/client';
import { CreateVipUserDto } from './dto/create-vip-user.dto';
import { UpdateVipUserDto } from './dto/update-vip-user.dto';

@Injectable()
export class VipUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<VipUser[]> {
    return this.prisma.vipUser.findMany({
      where: { userId },
      orderBy: [{ expiresAt: 'asc' }, { platformUsername: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateVipUserDto): Promise<VipUser> {
    return this.prisma.vipUser.create({
      data: {
        userId,
        platform: dto.platform,
        platformUsername: dto.platformUsername.trim(),
        bonusTickets: dto.bonusTickets,
        expiresAt: new Date(dto.expiresAt),
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateVipUserDto): Promise<VipUser> {
    const vip = await this.prisma.vipUser.findUnique({ where: { id } });
    if (!vip) throw new NotFoundException('VIP não encontrado');
    if (vip.userId !== userId) throw new ForbiddenException('Sem permissão');

    return this.prisma.vipUser.update({
      where: { id },
      data: {
        ...(dto.bonusTickets !== undefined && { bonusTickets: dto.bonusTickets }),
        ...(dto.expiresAt !== undefined && { expiresAt: new Date(dto.expiresAt) }),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const vip = await this.prisma.vipUser.findUnique({ where: { id } });
    if (!vip) throw new NotFoundException('VIP não encontrado');
    if (vip.userId !== userId) throw new ForbiddenException('Sem permissão');

    await this.prisma.vipUser.delete({ where: { id } });
  }

  /**
   * Find an active (non-expired) VIP entry for the given channel owner, platform and username.
   * Used by webhook handlers during message processing.
   */
  async findActiveVip(
    adminUserId: string,
    platform: ConnectedPlatform,
    username: string,
  ): Promise<VipUser | null> {
    return this.prisma.vipUser.findFirst({
      where: {
        userId: adminUserId,
        platform,
        platformUsername: { equals: username, mode: 'insensitive' },
        expiresAt: { gt: new Date() },
      },
    });
  }
}
