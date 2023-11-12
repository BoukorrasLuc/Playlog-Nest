import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const config = new DocumentBuilder()
    .setTitle('Playlog-Nest')
    .setDescription('The Playlog-Nest API description')
    .setVersion('1.0.0')
    .addTag('playlog')
    .build();

  const app = await NestFactory.create(AppModule);
  
  const logger = new Logger('bootstrap');

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3000, () => {
    logger.log('Application is running on: http://localhost:3000');
  });
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
}
bootstrap();
