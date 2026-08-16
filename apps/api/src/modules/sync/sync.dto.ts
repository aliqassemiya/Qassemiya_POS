import { createZodDto } from "nestjs-zod";
import { syncCatalogQuerySchema, syncPushRequestSchema } from "@qassemiya/shared-types";

export class SyncPushRequestDto extends createZodDto(syncPushRequestSchema) {}
export class SyncCatalogQueryDto extends createZodDto(syncCatalogQuerySchema) {}
