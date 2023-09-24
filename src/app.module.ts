import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserCollectionModule } from './user-collection/user-collection.module';
import { ItemScrappeDatabaseModule } from './ItemScrappeDatabase/item-scrappe-database.module';
import { SystemModule } from './system/system.module';
import { GameModule } from './game/game.module';
import { AccessoryModule } from './accessory/accessory.module';
import { PriceDataModule } from './priceData/priceData.module';
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
    PriceDataModule,
    ScrappingModule
  ],
})
export class AppModule {}
