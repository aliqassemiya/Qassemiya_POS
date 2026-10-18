import { Module } from "@nestjs/common";
import { ShopifyReturnsController } from "./shopify-returns.controller";
import { ShopifyReturnsService } from "./shopify-returns.service";

@Module({
  controllers: [ShopifyReturnsController],
  providers: [ShopifyReturnsService],
  exports: [ShopifyReturnsService],
})
export class ShopifyReturnsModule {}
