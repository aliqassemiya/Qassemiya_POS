import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { postJournalEntry } from "../../common/accounting/journal-ledger";
import type { CreateJournalEntryDto, JournalEntryListQueryDto } from "./journal-entries.dto";

const WITH_DETAILS = { lines: { include: { account: true } }, branch: true } as const;

@Injectable()
export class JournalEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: JournalEntryListQueryDto) {
    const where = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.from || query.to
        ? {
            entryDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [data, totalCount] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: WITH_DETAILS,
        orderBy: { entryDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return { data, totalCount };
  }

  async findOne(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!entry) throw new NotFoundException("Journal entry not found");
    return entry;
  }

  /** Manual entries only — sourceType is hardcoded to "MANUAL" here, never client-supplied. Used for opening balances and corrections. */
  async create(dto: CreateJournalEntryDto, userId: string) {
    const id = await this.prisma.$transaction((tx) =>
      postJournalEntry(tx, {
        entryDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
        description: dto.description,
        sourceType: "MANUAL",
        branchId: dto.branchId,
        createdByUserId: userId,
        lines: dto.lines,
      }),
    );
    return this.findOne(id);
  }
}
