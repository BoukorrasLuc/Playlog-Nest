import { Module } from '@nestjs/common';
import { ItemScrappeDatabaseService } from './item-scrappe-database.service';
import { ItemScrappeDatabaseController } from './item-scrappe-database.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ItemScrappeDatabaseController],
  providers: [ItemScrappeDatabaseService, PrismaService],
})
export class ItemScrappeDatabaseModule {}