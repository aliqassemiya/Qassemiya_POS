import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { PrismaModule } from "./common/prisma/prisma.module";
import { PdfRendererModule } from "./common/pdf/pdf-renderer.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { ResponseShapeInterceptor } from "./common/interceptors/response-shape.interceptor";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ProductsModule } from "./modules/products/products.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { PaymentMethodsModule } from "./modules/payment-methods/payment-methods.module";
import { SalesModule } from "./modules/sales/sales.module";
import { ReturnsModule } from "./modules/returns/returns.module";
import { ShopifyReturnsModule } from "./modules/shopify-returns/shopify-returns.module";
import { SyncModule } from "./modules/sync/sync.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { VendorsModule } from "./modules/vendors/vendors.module";
import { PurchaseOrdersModule } from "./modules/purchase-orders/purchase-orders.module";
import { GoodsReceiptsModule } from "./modules/goods-receipts/goods-receipts.module";
import { PurchaseInvoicesModule } from "./modules/purchase-invoices/purchase-invoices.module";
import { VendorPaymentsModule } from "./modules/vendor-payments/vendor-payments.module";
import { PurchaseReturnsModule } from "./modules/purchase-returns/purchase-returns.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { JournalEntriesModule } from "./modules/journal-entries/journal-entries.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { ShopifyModule } from "./modules/shopify/shopify.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { WhatsappModule } from "./modules/whatsapp/whatsapp.module";
import { TamaraModule } from "./modules/tamara/tamara.module";
import { TabbyModule } from "./modules/tabby/tabby.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    PdfRendererModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    EmployeesModule,
    CustomersModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    PaymentMethodsModule,
    SalesModule,
    ReturnsModule,
    ShopifyReturnsModule,
    SyncModule,
    ReportsModule,
    VendorsModule,
    PurchaseOrdersModule,
    GoodsReceiptsModule,
    PurchaseInvoicesModule,
    VendorPaymentsModule,
    PurchaseReturnsModule,
    AccountsModule,
    JournalEntriesModule,
    ExpensesModule,
    ShopifyModule,
    InvoicesModule,
    WhatsappModule,
    TamaraModule,
    TabbyModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseShapeInterceptor },
  ],
})
export class AppModule {}
