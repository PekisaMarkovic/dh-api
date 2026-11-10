import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '@/app.module';
import * as bodyParser from 'body-parser';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getDashboardUrl } from '@/common/helpers/url.helpers';

// http://localhost:4200/api
async function bootstrap() {
  const baseUrl = 'api';
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4200);
  // production needs APP_DASHBOARD to be set, otherwise the app does not start
  const dashboard = getDashboardUrl(configService);

  const config = new DocumentBuilder()
    .setTitle('DH API')
    .setDescription('DH API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  app.setGlobalPrefix(baseUrl);

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(baseUrl, app, document);

  app.getHttpAdapter().get('/swagger.json', (_, res) => res.json(document));

  app.enableCors({
    origin: [dashboard],
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, X-Portal-Type',
    credentials: true,
  });

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
}
bootstrap();
