import { Module } from "@nestjs/common";
import { TabbyController } from "./tabby.controller";
import { TabbyService } from "./tabby.service";

@Module({
  controllers: [TabbyController],
  providers: [TabbyService],
  exports: [TabbyService],
})
export class TabbyModule {}
