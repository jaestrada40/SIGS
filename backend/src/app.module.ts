import { Controller, Get, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SkipThrottle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController, JwtStrategy } from './auth/auth';
import { Campana, CampanasController } from './campanas/campanas';
import { JwtAuthGuard, Public, RolGuard, TipoGuard } from './common/auth';
import { Bitacora, BitacoraController } from './common/bitacora';
import { validarEntorno } from './common/cripto';
import { CatalogosController } from './common/geografia';
import { DashboardController } from './dashboard/dashboard';
import { Entidad } from './entidades/entidad.entity';
import { Estudio, EstudiosController } from './estudios/estudios';
import { Paciente, PacientesController } from './pacientes/pacientes';
import { Usuario } from './usuarios/usuario.entity';
import { UsuariosController } from './usuarios/usuarios';

// Para la comprobación de salud del contenedor y del proxy (no toca la base de datos ni exige sesión).
@Public() @SkipThrottle() @Controller('salud')
class SaludController { @Get() estado() { return { estado: 'ok' }; } }

export const configureApp = (app: INestApplication) => app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
    // En pruebas (NODE_ENV=test) se omite el límite para poder registrar muchas cuentas; en uso real aplica siempre.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }], skipIf: () => process.env.NODE_ENV === 'test' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres',
        host: c.get('DB_HOST'), port: Number(c.get('DB_PORT')), username: c.get('DB_USER'), password: c.get('DB_PASS'), database: c.get('DB_NAME'),
        entities: [Entidad, Usuario, Paciente, Estudio, Campana, Bitacora],
        // shortcut: sin migraciones el esquema se crea con synchronize. En producción solo si DB_SYNC=true (primer arranque o tras un cambio de esquema; ver DESPLIEGUE.md).
        synchronize: c.get('NODE_ENV') !== 'production' || c.get('DB_SYNC') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([Entidad, Usuario, Paciente, Estudio, Campana, Bitacora]),
    PassportModule,
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: (c: ConfigService) => ({ secret: c.getOrThrow('JWT_SECRET'), signOptions: { expiresIn: '2h', issuer: 'sisg', algorithm: 'HS256' } }) }),
  ],
  controllers: [AuthController, PacientesController, EstudiosController, CampanasController, DashboardController, BitacoraController, UsuariosController, CatalogosController, SaludController],
  providers: [JwtStrategy, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: RolGuard }, TipoGuard],
})
export class AppModule {}
