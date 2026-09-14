import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { RoleName } from "@qassemiya/shared-types";

export const createEmployeeSchema = z
  .object({
    employeeCode: z.string().min(1),
    fullName: z.string().min(1),
    email: z.string().email().optional(),
    branchId: z.string().uuid(),
    // Omit both to create a sales-attribution-only employee with no system
    // access at all (no login, no PIN, no roles) — e.g. floor staff who
    // should get credit for a sale without ever touching the till
    // themselves. Provide both to grant POS login: a linked User is
    // auto-provisioned (synthetic email, random password) so the employee
    // can hold roles/permissions immediately — employees only ever
    // authenticate via POS PIN login, never that generated password.
    pinCode: z.string().min(4).max(8).optional(),
    roles: z.array(z.nativeEnum(RoleName)).optional(),
  })
  .refine((data) => (data.pinCode && data.roles && data.roles.length > 0) || (!data.pinCode && !data.roles), {
    message: "Provide both a PIN and at least one role to grant system access, or neither for no access",
    path: ["pinCode"],
  });
export const updateEmployeeSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  branchId: z.string().uuid().optional(),
  roles: z.array(z.nativeEnum(RoleName)).optional(),
  pinCode: z.string().min(4).max(8).optional(),
  isActive: z.boolean().optional(),
});

export const resetPinSchema = z.object({
  pinCode: z.string().min(4).max(8),
});

// pageSize caps at 500, not the usual 50-200 — unlike a transactional list
// (orders, invoices), the total headcount across all branches is small and
// bounded, and callers like the Sales page's salesperson filter dropdown
// need the full roster, not just one page of it.
export const employeeListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(50),
});

export class CreateEmployeeDto extends createZodDto(createEmployeeSchema) {}
export class UpdateEmployeeDto extends createZodDto(updateEmployeeSchema) {}
export class ResetPinDto extends createZodDto(resetPinSchema) {}
export class EmployeeListQueryDto extends createZodDto(employeeListQuerySchema) {}
