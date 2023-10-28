import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('bootstrap');
  app.useGlobalPipes(new ValidationPipe())
  await app.listen(3000, () => {
    logger.log('Application is running on: http://localhost:3000');
  });
}
bootstrap();
