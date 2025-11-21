import { Injectable } from '@nestjs/common';
import { AuthProvider, User, UserRole } from '@prisma/client';
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

  create(data: {
    email: string;
    displayName: string;
    avatarUrl?: string;
    provider: AuthProvider;
    providerId: string;
    role?: UserRole;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
