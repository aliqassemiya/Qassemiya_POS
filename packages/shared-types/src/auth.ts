import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const posPinLoginSchema = z.object({
  employeeCode: z.string().min(1),
  pinCode: z.string().min(4).max(8),
  deviceUuid: z.string().uuid(),
});
export type PosPinLoginInput = z.infer<typeof posPinLoginSchema>;

export const registerDeviceSchema = z.object({
  deviceUuid: z.string().uuid(),
  name: z.string().min(1),
  branchId: z.string().uuid(),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
