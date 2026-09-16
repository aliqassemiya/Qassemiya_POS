import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import { startOfDayRiyadh, endOfDayRiyadh } from "../../common/utils/date-range";
import type { AccountLedgerQueryDto, AccountListQueryDto, CreateAccountDto, UpdateAccountDto } from "./accounts.dto";

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: AccountListQueryDto) {
    return this.prisma.account.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { code: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { code: "asc" },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException("Account not found");
    return account;
  }

  async create(dto: CreateAccountDto) {
    const existing = await this.prisma.account.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException("Account with this code already exists");

    return this.prisma.account.create({ data: { id: newId(), ...dto } });
  }

  /** code/type/isSystem are absent from UpdateAccountDto — same technique updatePurchaseOrderSchema uses to make fields immutable via the API, protecting auto-posting-critical accounts from being redefined. */
  async update(id: string, dto: UpdateAccountDto) {
    await this.findOne(id);
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  /**
   * Chronological JournalLines + running balance using THIS account's own
   * normalBalance (never the fixed per-type report sign convention reports
   * use) — the same shape VendorsService.statement() already implements.
   */
  async ledger(id: string, query: AccountLedgerQueryDto) {
    const account = await this.findOne(id);

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: id,
        journalEntry: {
          ...(query.branchId ? { branchId: query.branchId } : {}),
          ...(query.from || query.to
            ? {
                entryDate: {
                  ...(query.from ? { gte: startOfDayRiyadh(query.from) } : {}),
                  ...(query.to ? { lte: endOfDayRiyadh(query.to) } : {}),
                },
              }
            : {}),
        },
      },
      include: { journalEntry: true },
      orderBy: [{ journalEntry: { entryDate: "asc" } }, { id: "asc" }],
    });

    const sign = account.normalBalance === "DEBIT" ? 1 : -1;
    let balance = 0;
    const entries = lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      balance += sign * (debit - credit);
      return {
        journalEntryId: line.journalEntryId,
        date: line.journalEntry.entryDate,
        description: line.description ?? line.journalEntry.description ?? "",
        sourceType: line.journalEntry.sourceType,
        sourceId: line.journalEntry.sourceId,
        debit,
        credit,
        balance,
      };
    });

    return { account, entries, closingBalance: balance };
  }
}
