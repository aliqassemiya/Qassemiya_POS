import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { postJournalEntry, resolvePaymentAccountId } from "../../common/accounting/journal-ledger";
import { newId } from "../../common/utils/uuid";
import type { CreateExpenseDto, ExpenseListQueryDto } from "./expenses.dto";

const WITH_DETAILS = { categoryAccount: true, paidByMethod: true, branch: true } as const;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ExpenseListQueryDto) {
    return this.prisma.expense.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.categoryAccountId ? { categoryAccountId: query.categoryAccountId } : {}),
        ...(query.from || query.to
          ? {
              expenseDate: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: WITH_DETAILS,
      orderBy: { expenseDate: "desc" },
    });
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!expense) throw new NotFoundException("Expense not found");
    return expense;
  }

  /** GL posting: Dr categoryAccountId / Cr the paid-by method's mapped account. */
  async create(dto: CreateExpenseDto, userId: string) {
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.create({
        data: {
          id,
          branchId: dto.branchId,
          categoryAccountId: dto.categoryAccountId,
          amount: dto.amount,
          paidByMethodId: dto.paidByMethodId,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
          description: dto.description,
          createdByUserId: userId,
        },
      });

      const paymentAccountId = await resolvePaymentAccountId(tx, dto.paidByMethodId);
      await postJournalEntry(tx, {
        entryDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        description: dto.description ?? "Expense",
        sourceType: "EXPENSE",
        sourceId: id,
        branchId: dto.branchId,
        createdByUserId: userId,
        lines: [
          { accountId: dto.categoryAccountId, debit: dto.amount, description: "Expense" },
          { accountId: paymentAccountId, credit: dto.amount, description: "Payment out" },
        ],
      });
    });
    return this.findOne(id);
  }
}
