import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { SyncService } from "./sync.service";
import { SyncCatalogQueryDto, SyncPushRequestDto } from "./sync.dto";

@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("push")
  push(@Body() dto: SyncPushRequestDto) {
    return this.syncService.push(dto);
  }

  @Get("catalog")
  catalog(@Query() query: SyncCatalogQueryDto) {
    return this.syncService.catalog(query);
  }

  @Get("status")
  status(@Query("deviceUuid") deviceUuid?: string) {
    return this.syncService.status(deviceUuid);
  }
}
