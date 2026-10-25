import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Rol, TipoEntidad } from '../common/enums';

export class LoginDto {
  @IsEmail() @MaxLength(120) correo: string;
  @IsString() @IsNotEmpty() @MaxLength(72) password: string;   // bcrypt solo considera los primeros 72 bytes
}
export class RegistroDto extends LoginDto {
  @IsString() @IsNotEmpty() @MaxLength(120) nombre: string;
  @IsEnum(TipoEntidad) tipo: TipoEntidad;
  @IsOptional() @IsString() @MaxLength(60) departamento?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsString() @MinLength(10) @MaxLength(72) declare password: string;
}
export class CodigoDto {
  @IsString() @IsNotEmpty() @MaxLength(20) codigo: string;
}
export class MfaVerificarDto extends CodigoDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) mfa_token: string;
}
export class CambiarPasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(72) actual: string;
  @IsString() @MinLength(10) @MaxLength(72) nueva: string;
}
export class CrearUsuarioDto {
  @IsString() @IsNotEmpty() @MaxLength(120) nombre: string;
  @IsEmail() @MaxLength(120) correo: string;
  @IsEnum(Rol) rol: Rol;
  @IsString() @MinLength(10) @MaxLength(72) password: string;
}
export class ActualizarUsuarioDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) nombre?: string;
  @IsOptional() @IsEnum(Rol) rol?: Rol;
  @IsOptional() activo?: boolean;
}
export class NuevaPasswordDto {
  @IsString() @MinLength(10) @MaxLength(72) password: string;
}
