import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserCollectionModule } from './api/user-collection/user-collection.module';
import { ItemScrappeDatabaseModule } from './api/ItemScrappeDatabase/item-scrappe-database.module';
import { SystemModule } from './api/system/system.module';
import { GameModule } from './api/game/game.module';
import { AccessoryModule } from './api/accessory/accessory.module';
import { ScrappingModule } from './scrapping/scrapping.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    UserCollectionModule,
    ItemScrappeDatabaseModule,
    SystemModule,
    GameModule,
    AccessoryModule,
    ScrappingModule
  ],
})
export class AppModule {}
