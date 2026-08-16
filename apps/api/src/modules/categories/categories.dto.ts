import { createZodDto } from "nestjs-zod";
import { categorySchema } from "@qassemiya/shared-types";

export class CreateCategoryDto extends createZodDto(categorySchema) {}
export class UpdateCategoryDto extends createZodDto(categorySchema.partial()) {}
