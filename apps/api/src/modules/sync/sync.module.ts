import { Module } from "@nestjs/common";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";
import { SalesModule } from "../sales/sales.module";
import { ReturnsModule } from "../returns/returns.module";

@Module({
  imports: [SalesModule, ReturnsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
