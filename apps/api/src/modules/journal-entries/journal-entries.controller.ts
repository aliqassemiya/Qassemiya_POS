import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JournalEntriesService } from "./journal-entries.service";
import { CreateJournalEntryDto, JournalEntryListQueryDto } from "./journal-entries.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/auth-request";

@Controller("journal-entries")
@UseGuards(PermissionsGuard)
@RequirePermissions("reports.financial.view")
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  findAll(@Query() query: JournalEntryListQueryDto) {
    return this.journalEntriesService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.journalEntriesService.findOne(id);
  }

  @Post()
  @RequirePermissions("journal.manage")
  create(@Body() dto: CreateJournalEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.journalEntriesService.create(dto, user.userId);
  }
}
