import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Rol, TipoEntidad } from './enums';

export const Public = (v = true) => SetMetadata('public', v);
export const Roles = (...r: Rol[]) => SetMetadata('roles', r);
export const SoloTipo = (t: TipoEntidad) => SetMetadata('tipo', t);
// Token payload as set by JwtStrategy: { entidadId, tipo }
export const Entidad = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private r: Reflector) { super(); }
  canActivate(ctx: ExecutionContext) {
    return this.r.getAllAndOverride('public', [ctx.getHandler(), ctx.getClass()]) ? true : super.canActivate(ctx);
  }
}

@Injectable()
export class TipoGuard implements CanActivate {
  constructor(private r: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const t = this.r.getAllAndOverride<TipoEntidad>('tipo', [ctx.getHandler(), ctx.getClass()]);
    if (t && ctx.switchToHttp().getRequest().user?.tipo !== t) throw new ForbiddenException();
    return true;
  }
}

// Sin @Roles: cualquier rol lee; el AUDITOR no puede escribir (todo lo que no sea GET).
@Injectable()
export class RolGuard implements CanActivate {
  constructor(private r: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) return true;   // rutas públicas o con su propio guard
    const roles = this.r.getAllAndOverride<Rol[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (roles) { if (!roles.includes(req.user.rol)) throw new ForbiddenException(); return true; }
    if (req.user.rol === Rol.AUDITOR && req.method !== 'GET') throw new ForbiddenException('El rol Auditor es de solo lectura.');
    return true;
  }
}
