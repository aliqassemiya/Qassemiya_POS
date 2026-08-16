import { BadRequestException } from "@nestjs/common";
import { newId } from "../utils/uuid";
import type { Prisma } from "../../../generated/prisma";

export interface JournalLineParams {
  accountId: string;
  /** Exactly one of debit/credit should be positive on any given line — never both. */
  debit?: number;
  credit?: number;
  description?: string;
}

export interface PostJournalEntryParams {
  entryDate: Date;
  description?: string;
  /** Free string mirroring StockMovement.referenceType's forward-compat rationale, e.g. "SALE", "SALE_VOID", "RETURN", "GOODS_RECEIPT", "PURCHASE_INVOICE", "PURCHASE_INVOICE_CANCEL", "VENDOR_PAYMENT", "PURCHASE_RETURN", "INVENTORY_ADJUSTMENT", "EXPENSE", "MANUAL". */
  sourceType: string;
  sourceId?: string;
  /** Nullable since VendorPayment (and manual entries) have no natural branch. */
  branchId?: string;
  createdByUserId?: string;
  /** Set when this entry is a mirror-reversal of a prior entry (void/cancel). */
  reversalOfEntryId?: string;
  lines: JournalLineParams[];
}

/** Converts a money amount to integer cents so the balance check never suffers float drift. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Single choke point for every journal posting in the system: validates the
 * double-entry balance invariant (Σdebit === Σcredit, compared in integer
 * cents) and writes the append-only JournalEntry + JournalLine rows in one
 * nested create — mirroring `stock-ledger.ts`'s `applyStockMovement()`
 * shape exactly. Journal entries are never updated or deleted; corrections
 * happen via a new reversing entry (reversalOfEntryId), never editing
 * history.
 *
 * Must be called with a transactional Prisma client so the entry and its
 * lines are atomic together with whatever business event triggered them
 * (sale, return, purchase, etc.) in the caller's own $transaction.
 */
export async function postJournalEntry(tx: Prisma.TransactionClient, params: PostJournalEntryParams): Promise<string> {
  if (params.lines.length < 2) {
    throw new BadRequestException("A journal entry needs at least two lines");
  }

  let debitCents = 0;
  let creditCents = 0;
  for (const line of params.lines) {
    const debit = line.debit ?? 0;
    const credit = line.credit ?? 0;
    if (debit < 0 || credit < 0) {
      throw new BadRequestException("Journal line debit/credit cannot be negative");
    }
    if (debit > 0 && credit > 0) {
      throw new BadRequestException("Journal line cannot have both a debit and a credit");
    }
    debitCents += toCents(debit);
    creditCents += toCents(credit);
  }

  if (debitCents !== creditCents) {
    throw new BadRequestException(
      `Journal entry does not balance: debits=${debitCents / 100} credits=${creditCents / 100}`,
    );
  }
  if (debitCents === 0) {
    throw new BadRequestException("Journal entry has zero net amount");
  }

  const id = newId();
  await tx.journalEntry.create({
    data: {
      id,
      entryDate: params.entryDate,
      description: params.description,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      branchId: params.branchId,
      createdByUserId: params.createdByUserId,
      reversalOfEntryId: params.reversalOfEntryId,
      lines: {
        create: params.lines.map((line) => ({
          id: newId(),
          accountId: line.accountId,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          description: line.description,
        })),
      },
    },
  });

  return id;
}

/**
 * Single place "what GL account does this payment method hit" is looked
 * up, reused by every posting call site (sale payments, return refunds,
 * vendor payments, expense payments). Throws if the payment method has no
 * mapped account — every seeded/active payment method must have one.
 */
export async function resolvePaymentAccountId(tx: Prisma.TransactionClient, paymentMethodId: string): Promise<string> {
  const paymentMethod = await tx.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!paymentMethod) {
    throw new BadRequestException(`Payment method ${paymentMethodId} not found`);
  }
  if (!paymentMethod.glAccountId) {
    throw new BadRequestException(`Payment method ${paymentMethod.code} has no mapped GL account`);
  }
  return paymentMethod.glAccountId;
}

/**
 * Fixed-code account lookup (e.g. "1100" Inventory, "5000" COGS) used by
 * every posting call site that hits a well-known system account. Every
 * code referenced here must exist in the seeded starter chart of accounts.
 */
export async function resolveAccountIdByCode(tx: Prisma.TransactionClient, code: string): Promise<string> {
  const account = await tx.account.findUnique({ where: { code } });
  if (!account) {
    throw new BadRequestException(`Chart of accounts is missing required account ${code} — has the seed run?`);
  }
  return account.id;
}
