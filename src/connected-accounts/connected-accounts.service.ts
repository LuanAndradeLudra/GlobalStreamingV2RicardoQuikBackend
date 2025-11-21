import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectedAccount } from '@prisma/client';
import { CreateConnectedAccountDto } from './dto/create-connected-account.dto';

@Injectable()
export class ConnectedAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<ConnectedAccount[]> {
    return this.prisma.connectedAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrUpdate(
    userId: string,
    data: CreateConnectedAccountDto,
  ): Promise<ConnectedAccount> {
    const { platform, externalChannelId, expiresAt, ...accountData } = data;
    const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;

    return this.prisma.connectedAccount.upsert({
      where: {
        platform_externalChannelId: {
          platform,
          externalChannelId,
        },
      },
      update: {
        ...accountData,
        expiresAt: expiresAtDate,
        userId,
        updatedAt: new Date(),
      },
      create: {
        ...accountData,
        expiresAt: expiresAtDate,
        userId,
        platform,
        externalChannelId,
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Connected account with ID ${id} not found`);
    }

    await this.prisma.connectedAccount.delete({
      where: { id },
    });
  }
}

