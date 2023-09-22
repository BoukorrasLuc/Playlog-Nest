import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SystemController],
  providers: [SystemService,PrismaService],
})
export class SystemModule {}