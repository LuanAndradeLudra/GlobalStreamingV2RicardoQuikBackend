import { Injectable } from '@nestjs/common';
import { AuthProvider, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByProviderId(providerId: string, provider: AuthProvider): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        provider,
        providerId,
      },
    });
  }
}
