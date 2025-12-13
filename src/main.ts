import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
  });
  const configService = app.get(ConfigService);

  // Increase body size limit for large payloads (e.g., Twitch subscriptions with many gift subs)
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // CORS configuration
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  const isDevelopment = configService.get<string>('NODE_ENV') !== 'production';
  
  app.enableCors({
    origin: isDevelopment
      ? [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
        ]
      : frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Zambark API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  // Set global prefix for all routes except public auth routes
  app.setGlobalPrefix('api', {
    exclude: ['auth/google', 'auth/google/callback'],
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`🚀 API is running on port ${port}`);
  console.log(`📚 Swagger documentation available at ${isDevelopment ? `http://localhost:${port}/api/docs` : `${frontendUrl}/api/docs`}`);
  console.log(`🌐 CORS enabled for: ${isDevelopment ? 'localhost origins' : frontendUrl}`);
}

bootstrap();
