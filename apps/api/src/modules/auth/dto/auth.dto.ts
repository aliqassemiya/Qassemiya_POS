import { createZodDto } from "nestjs-zod";
import { loginSchema, posPinLoginSchema, registerDeviceSchema, refreshTokenSchema } from "@qassemiya/shared-types";

export class LoginDto extends createZodDto(loginSchema) {}
export class PosPinLoginDto extends createZodDto(posPinLoginSchema) {}
export class RegisterDeviceDto extends createZodDto(registerDeviceSchema) {}
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
