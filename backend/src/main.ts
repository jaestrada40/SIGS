import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule, configureApp } from './app.module';

// La API ya no sirve pantallas: la raíz lleva al frontend (carpeta nuevo-diseño).
const FRONTEND = (process.env.FRONTEND_URL ?? 'http://localhost:8080').replace(/\/$/, '');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Detrás de un proxy (Coolify/Traefik) la IP real viene en X-Forwarded-For; sin esto el bloqueo por intentos y el límite de peticiones verían todos la IP del proxy.
  if (process.env.TRUST_PROXY) app.getHttpAdapter().getInstance().set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  app.use(helmet());
  app.use((req: any, res: any, next: () => void) => {
    return req.method === 'GET' && req.path === '/' ? res.redirect(302, FRONTEND + '/') : next();
  });
  // El frontend nuevo corre en otro puerto; solo esos orígenes pueden llamar a la API desde el navegador.
  app.enableCors({
    origin: [FRONTEND, 'http://127.0.0.1:8080', 'http://localhost:5173', ...(process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
