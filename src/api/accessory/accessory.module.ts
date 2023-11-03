import { Module } from '@nestjs/common';
import { AccessoryService } from './accessory.service';
import { AccessoryController } from './accessory.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [AccessoryController],
  providers: [AccessoryService,PrismaService],
})
export class AccessoryModule {}