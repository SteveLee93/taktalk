import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // DTO 유효성 검사
  app.useGlobalPipes(new ValidationPipe());

  // CORS 설정
  app.enableCors({
    // origin: 'http://localhost:3001', // 프론트엔드 URL
    origin: 'https://www.talk-tak.com',       // <- 슬래시 없이
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('TakTalk API')
    .setDescription('TakTalk 리그 관리 API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // 포트: 환경변수(PORT)가 있으면 사용, 아니면 3000
  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
