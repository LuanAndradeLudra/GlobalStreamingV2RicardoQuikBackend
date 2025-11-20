import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// PrismaModule exposes a shared instance of the PrismaClient to the rest of the application.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
