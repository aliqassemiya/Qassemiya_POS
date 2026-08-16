import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AccountsService } from "./accounts.service";
import { AccountLedgerQueryDto, AccountListQueryDto, CreateAccountDto, UpdateAccountDto } from "./accounts.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

// GET routes are intentionally left open to any authenticated user (matching
// BranchesController/ProductsController's convention) — expenses.manage and
// journal.manage both need to read the account list to populate a picker
// without also holding full accounts.manage rights.
@Controller("accounts")
@UseGuards(PermissionsGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(@Query() query: AccountListQueryDto) {
    return this.accountsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.accountsService.findOne(id);
  }

  @Post()
  @RequirePermissions("accounts.manage")
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("accounts.manage")
  update(@Param("id") id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, dto);
  }

  // Grouped with the financial reports under reports.financial.view rather
  // than accounts.manage — it's a read-only General Ledger view, not chart
  // of accounts administration.
  @Get(":id/ledger")
  @RequirePermissions("reports.financial.view")
  ledger(@Param("id") id: string, @Query() query: AccountLedgerQueryDto) {
    return this.accountsService.ledger(id, query);
  }
}
