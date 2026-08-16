import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
});
export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});
export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
});

export class CreateUserDto extends createZodDto(createUserSchema) {}
export class UpdateUserDto extends createZodDto(updateUserSchema) {}
export class AssignRoleDto extends createZodDto(assignRoleSchema) {}
