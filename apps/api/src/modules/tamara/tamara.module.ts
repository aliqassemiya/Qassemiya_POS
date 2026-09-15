import { Module } from "@nestjs/common";
import { TamaraController } from "./tamara.controller";
import { TamaraService } from "./tamara.service";

@Module({
  controllers: [TamaraController],
  providers: [TamaraService],
  exports: [TamaraService],
})
export class TamaraModule {}
