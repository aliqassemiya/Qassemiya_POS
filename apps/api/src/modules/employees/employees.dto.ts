import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { RoleName } from "@qassemiya/shared-types";

export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  fullName: z.string().min(1),
  pinCode: z.string().min(4).max(8),
  branchId: z.string().uuid(),
  // Role names to grant, scoped to `branchId`. A linked login User is
  // auto-provisioned (synthetic email, random password) so the employee can
  // hold roles/permissions immediately — employees only ever authenticate via
  // POS PIN login, never that generated password.
  roles: z.array(z.nativeEnum(RoleName)).min(1),
});
export const updateEmployeeSchema = z.object({
  fullName: z.string().min(1).optional(),
  branchId: z.string().uuid().optional(),
  roles: z.array(z.nativeEnum(RoleName)).optional(),
  pinCode: z.string().min(4).max(8).optional(),
  isActive: z.boolean().optional(),
});

export const resetPinSchema = z.object({
  pinCode: z.string().min(4).max(8),
});

export class CreateEmployeeDto extends createZodDto(createEmployeeSchema) {}
export class UpdateEmployeeDto extends createZodDto(updateEmployeeSchema) {}
export class ResetPinDto extends createZodDto(resetPinSchema) {}
