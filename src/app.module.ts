import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserCollectionModule } from './user-collection/user-collection.module';
import { ItemScrappeDatabaseModule } from './ItemScrappeDatabase/item-scrappe-database.module';
import { SystemModule } from './system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    UserCollectionModule,
    ItemScrappeDatabaseModule,
    SystemModule
  ],
})
export class AppModule {}
