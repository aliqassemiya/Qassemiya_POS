"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const argon2 = __importStar(require("argon2"));
const prisma_1 = require("../generated/prisma");
const uuid_1 = require("../src/common/utils/uuid");
const stock_ledger_1 = require("../src/common/inventory/stock-ledger");
const journal_ledger_1 = require("../src/common/accounting/journal-ledger");
const shared_types_1 = require("@qassemiya/shared-types");
const prisma = new prisma_1.PrismaClient();
const ROLE_PERMISSIONS = {
    [shared_types_1.RoleName.SUPER_ADMIN]: shared_types_1.PERMISSIONS,
    [shared_types_1.RoleName.BRANCH_MANAGER]: [
        "employees.manage",
        "customers.manage",
        "catalog.manage",
        "inventory.view",
        "inventory.adjust",
        "pos.sale.create",
        "pos.sale.void",
        "pos.return.create",
        "reports.view",
        "purchases.po.manage",
        "purchases.receive",
        "purchases.return.create",
        "reports.financial.view",
        "expenses.manage",
        "reports.channel.view",
    ],
    [shared_types_1.RoleName.CASHIER]: ["pos.sale.create", "pos.return.create", "inventory.view", "customers.manage"],
    [shared_types_1.RoleName.INVENTORY_CLERK]: ["inventory.view", "inventory.adjust", "catalog.manage", "reports.view", "purchases.receive"],
};
const ROLE_DESCRIPTIONS = {
    [shared_types_1.RoleName.SUPER_ADMIN]: "Full access across all branches",
    [shared_types_1.RoleName.BRANCH_MANAGER]: "Manages a single branch's staff, catalog, inventory and sales",
    [shared_types_1.RoleName.CASHIER]: "Rings up sales and returns at the POS",
    [shared_types_1.RoleName.INVENTORY_CLERK]: "Manages stock levels and catalog data",
};
async function main() {
    console.log("Seeding Qassemiya POS database...\n");
    // ---------- Branches ----------
    // Real branch codes/names as used by the business (short numeric codes,
    // not UUIDs — the UUID is still the DB primary key, but `code` is what
    // staff enter/see, e.g. on the POS pairing screen).
    const BRANCHES = [
        { code: "5", name: "Main Warehouse", address: "Saudi Arabia" },
        { code: "201", name: "Olaya Mall - Riyadh", address: "Riyadh, Saudi Arabia" },
        { code: "206", name: "Flamingo - Dammam", address: "Dammam, Saudi Arabia" },
        { code: "207", name: "Marina - Dammam", address: "Dammam, Saudi Arabia" },
        { code: "209", name: "Arab Mall - Jeddah", address: "Jeddah, Saudi Arabia" },
        { code: "212", name: "Marina - Riyadh", address: "Riyadh, Saudi Arabia" },
        { code: "214", name: "Red Sea Mall - Jeddah", address: "Jeddah, Saudi Arabia" },
        { code: "217", name: "Riyadh Park", address: "Riyadh, Saudi Arabia" },
        { code: "219", name: "Nakheel Mall", address: "Riyadh, Saudi Arabia" },
        // "Al Faisaliyah" branch omitted — its code wasn't confirmed; add it via the admin panel once known.
    ];
    const branchByCode = new Map();
    for (const b of BRANCHES) {
        const row = await prisma.branch.upsert({
            where: { code: b.code },
            update: { name: b.name, address: b.address },
            create: { id: (0, uuid_1.newId)(), code: b.code, name: b.name, address: b.address, vatNumber: "300000000000003" },
        });
        branchByCode.set(b.code, row);
    }
    console.log(`Branches: ${branchByCode.size} seeded`);
    // Demo employees/products/stock below are seeded against this one branch.
    const branch = branchByCode.get("201");
    // ---------- Permissions ----------
    const permissionByCode = new Map();
    for (const code of shared_types_1.PERMISSIONS) {
        const permission = await prisma.permission.upsert({
            where: { code },
            update: {},
            create: { id: (0, uuid_1.newId)(), code },
        });
        permissionByCode.set(code, permission);
    }
    console.log(`Permissions: ${permissionByCode.size} seeded`);
    // ---------- Roles + RolePermission grants ----------
    const roleByName = new Map();
    for (const roleName of Object.values(shared_types_1.RoleName)) {
        const role = await prisma.role.upsert({
            where: { name: roleName },
            update: { description: ROLE_DESCRIPTIONS[roleName] },
            create: { id: (0, uuid_1.newId)(), name: roleName, description: ROLE_DESCRIPTIONS[roleName] },
        });
        roleByName.set(roleName, role);
        for (const permCode of ROLE_PERMISSIONS[roleName] ?? []) {
            const permission = permissionByCode.get(permCode);
            if (!permission)
                continue;
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
                update: {},
                create: { id: (0, uuid_1.newId)(), roleId: role.id, permissionId: permission.id },
            });
        }
    }
    console.log(`Roles: ${roleByName.size} seeded with permission grants`);
    // ---------- Users ----------
    const credentials = [];
    async function upsertUser(email, password, fullName, label) {
        const passwordHash = await argon2.hash(password);
        const user = await prisma.user.upsert({
            where: { email },
            update: { passwordHash, fullName },
            create: { id: (0, uuid_1.newId)(), email, passwordHash, fullName },
        });
        credentials.push({ label, email, password });
        return user;
    }
    const adminUser = await upsertUser("admin@qassemiya.com", "SuperAdmin123!", "Super Admin", "SUPER_ADMIN");
    const cashier1 = await upsertUser("cashier1@qassemiya.com", "Cashier123!", "Fatimah Al-Harbi", "CASHIER #1");
    const cashier2 = await upsertUser("cashier2@qassemiya.com", "Cashier123!", "Noura Al-Qahtani", "CASHIER #2");
    async function grantRole(userId, roleName, branchId) {
        // Prisma's composite-unique where clause rejects null members, so a
        // nullable branchId (global grants) needs a manual find-then-create
        // instead of upsert().
        const role = roleByName.get(roleName);
        const existing = await prisma.userRole.findFirst({ where: { userId, roleId: role.id, branchId } });
        if (existing)
            return;
        await prisma.userRole.create({ data: { id: (0, uuid_1.newId)(), userId, roleId: role.id, branchId } });
    }
    await grantRole(adminUser.id, shared_types_1.RoleName.SUPER_ADMIN, null);
    await grantRole(cashier1.id, shared_types_1.RoleName.CASHIER, branch.id);
    await grantRole(cashier2.id, shared_types_1.RoleName.CASHIER, branch.id);
    console.log("Users: 1 SUPER_ADMIN + 2 CASHIER seeded with role grants");
    // ---------- Employees (POS PIN login identities, linked to the cashier users) ----------
    async function upsertEmployee(employeeCode, fullName, pinCode, userId) {
        const pinCodeHash = await argon2.hash(pinCode);
        await prisma.employee.upsert({
            where: { employeeCode },
            update: { fullName, pinCodeHash, userId, branchId: branch.id },
            create: { id: (0, uuid_1.newId)(), employeeCode, fullName, pinCodeHash, branchId: branch.id, userId },
        });
        credentials.push({ label: `Employee ${employeeCode} PIN`, email: employeeCode, password: pinCode });
    }
    await upsertEmployee("EMP001", "Fatimah Al-Harbi", "1234", cashier1.id);
    await upsertEmployee("EMP002", "Noura Al-Qahtani", "5678", cashier2.id);
    console.log("Employees: 2 seeded for POS PIN login\n");
    // ---------- Payment methods ----------
    const paymentMethods = [
        { code: shared_types_1.PaymentMethodCode.CASH, name: "Cash", isActive: true },
        { code: shared_types_1.PaymentMethodCode.CARD, name: "Card (mada/Visa/Mastercard)", isActive: true },
        { code: shared_types_1.PaymentMethodCode.TABBY, name: "Tabby (BNPL)", isActive: true },
        { code: shared_types_1.PaymentMethodCode.TAMARA, name: "Tamara (BNPL)", isActive: true },
    ];
    for (const pm of paymentMethods) {
        await prisma.paymentMethod.upsert({
            where: { code: pm.code },
            update: { name: pm.name, isActive: pm.isActive },
            create: { id: (0, uuid_1.newId)(), ...pm },
        });
    }
    console.log(`Payment methods: ${paymentMethods.length} seeded`);
    const ACCOUNTS = [
        { code: "1000", name: "Cash on Hand", nameAr: "النقد في الصندوق", type: shared_types_1.AccountType.ASSET, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: true },
        { code: "1010", name: "Card Clearing", nameAr: "تسوية البطاقات", type: shared_types_1.AccountType.ASSET, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: true },
        { code: "1020", name: "Tabby Receivable", nameAr: "ذمم تابي", type: shared_types_1.AccountType.ASSET, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: true },
        { code: "1030", name: "Tamara Receivable", nameAr: "ذمم تمارا", type: shared_types_1.AccountType.ASSET, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: true },
        { code: "1050", name: "Accounts Receivable", nameAr: "ذمم مدينة", type: shared_types_1.AccountType.ASSET, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: true },
        { code: "1100", name: "Inventory", nameAr: "المخزون", type: shared_types_1.AccountType.ASSET, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: true },
        { code: "1200", name: "VAT Receivable", nameAr: "ضريبة القيمة المضافة المستحقة القبض", type: shared_types_1.AccountType.ASSET, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: true },
        { code: "2000", name: "Accounts Payable", nameAr: "ذمم دائنة", type: shared_types_1.AccountType.LIABILITY, normalBalance: shared_types_1.NormalBalance.CREDIT, isSystem: true },
        { code: "2050", name: "بضاعة مستلمة غير مفوترة", nameAr: "بضاعة مستلمة غير مفوترة", type: shared_types_1.AccountType.LIABILITY, normalBalance: shared_types_1.NormalBalance.CREDIT, isSystem: true },
        { code: "2100", name: "ضريبة القيمة المضافة المستحقة الدفع", nameAr: "ضريبة القيمة المضافة المستحقة الدفع", type: shared_types_1.AccountType.LIABILITY, normalBalance: shared_types_1.NormalBalance.CREDIT, isSystem: true },
        { code: "2200", name: "Gift Card Liability", nameAr: "التزام بطاقات الهدايا", type: shared_types_1.AccountType.LIABILITY, normalBalance: shared_types_1.NormalBalance.CREDIT, isSystem: true },
        { code: "2300", name: "Store Credit Liability", nameAr: "التزام رصيد المتجر", type: shared_types_1.AccountType.LIABILITY, normalBalance: shared_types_1.NormalBalance.CREDIT, isSystem: true },
        { code: "3000", name: "Owner's Equity", nameAr: "حقوق الملكية", type: shared_types_1.AccountType.EQUITY, normalBalance: shared_types_1.NormalBalance.CREDIT, isSystem: true },
        { code: "3900", name: "Retained Earnings", nameAr: "الأرباح المحتجزة", type: shared_types_1.AccountType.EQUITY, normalBalance: shared_types_1.NormalBalance.CREDIT, isSystem: true },
        { code: "4000", name: "Sales Revenue", nameAr: "إيرادات المبيعات", type: shared_types_1.AccountType.REVENUE, normalBalance: shared_types_1.NormalBalance.CREDIT, isSystem: true },
        {
            code: "4100",
            name: "Sales Returns & Allowances",
            nameAr: "مردودات ومسموحات المبيعات",
            type: shared_types_1.AccountType.REVENUE,
            normalBalance: shared_types_1.NormalBalance.DEBIT, // contra-revenue: debit-normal despite being type REVENUE
            isSystem: true,
        },
        { code: "5000", name: "Cost of Goods Sold", nameAr: "تكلفة البضاعة المباعة", type: shared_types_1.AccountType.COGS, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: true },
        { code: "6100", name: "Rent Expense", nameAr: "مصروف الإيجار", type: shared_types_1.AccountType.EXPENSE, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: false },
        { code: "6200", name: "Utilities Expense", nameAr: "مصروف المرافق", type: shared_types_1.AccountType.EXPENSE, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: false },
        { code: "6300", name: "Salaries & Wages", nameAr: "الرواتب والأجور", type: shared_types_1.AccountType.EXPENSE, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: false },
        { code: "6400", name: "Marketing & Advertising", nameAr: "التسويق والإعلان", type: shared_types_1.AccountType.EXPENSE, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: false },
        { code: "6500", name: "Office & Store Supplies", nameAr: "مستلزمات المكتب والمتجر", type: shared_types_1.AccountType.EXPENSE, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: false },
        {
            code: "6800",
            name: "Inventory Shrinkage & Adjustments",
            nameAr: "هالك وتسويات المخزون",
            type: shared_types_1.AccountType.EXPENSE,
            normalBalance: shared_types_1.NormalBalance.DEBIT,
            isSystem: true,
        },
        { code: "6900", name: "Miscellaneous Expense", nameAr: "مصاريف متنوعة", type: shared_types_1.AccountType.EXPENSE, normalBalance: shared_types_1.NormalBalance.DEBIT, isSystem: false },
    ];
    const accountByCode = new Map();
    for (const a of ACCOUNTS) {
        const row = await prisma.account.upsert({
            where: { code: a.code },
            update: { name: a.name, nameAr: a.nameAr, type: a.type, normalBalance: a.normalBalance, isSystem: a.isSystem },
            create: { id: (0, uuid_1.newId)(), code: a.code, name: a.name, nameAr: a.nameAr, type: a.type, normalBalance: a.normalBalance, isSystem: a.isSystem },
        });
        accountByCode.set(a.code, row);
    }
    console.log(`Chart of accounts: ${accountByCode.size} accounts seeded`);
    // Payment-method -> GL account mapping (PaymentMethod.glAccountId).
    // GIFT_CARD (2200) / STORE_CREDIT (2300) accounts exist in the chart for
    // completeness but have no mapping here since those PaymentMethod rows
    // aren't seeded above.
    const PAYMENT_METHOD_ACCOUNT_CODE = {
        [shared_types_1.PaymentMethodCode.CASH]: "1000",
        [shared_types_1.PaymentMethodCode.CARD]: "1010",
        [shared_types_1.PaymentMethodCode.TABBY]: "1020",
        [shared_types_1.PaymentMethodCode.TAMARA]: "1030",
    };
    for (const [code, accountCode] of Object.entries(PAYMENT_METHOD_ACCOUNT_CODE)) {
        const account = accountByCode.get(accountCode);
        if (!account)
            continue;
        await prisma.paymentMethod.updateMany({ where: { code }, data: { glAccountId: account.id } });
    }
    console.log("Payment methods: mapped to GL accounts");
    // ---------- Categories ----------
    async function upsertCategory(name, nameAr) {
        const existing = await prisma.category.findFirst({ where: { name } });
        if (existing)
            return existing;
        return prisma.category.create({ data: { id: (0, uuid_1.newId)(), name, nameAr } });
    }
    const dresses = await upsertCategory("Dresses", "فساتين");
    const abayas = await upsertCategory("Abayas", "عبايات");
    const accessories = await upsertCategory("Accessories", "إكسسوارات");
    console.log("Categories: 3 seeded");
    // ---------- Vendors ----------
    // The client's real vendor codes from the old system. Placeholder names
    // until the client provides real ones — editable via the admin UI.
    const VENDORS = [
        { code: "TN", numericCode: 40 },
        { code: "KV", numericCode: 61 },
        { code: "SH", numericCode: 68 },
        { code: "NJ", numericCode: 112 },
        { code: "AD", numericCode: 130 },
        { code: "LN", numericCode: 132 },
        { code: "MO", numericCode: 133 },
        { code: "SK", numericCode: 138 },
        { code: "FI", numericCode: 139 },
        { code: "UP", numericCode: 141 },
    ];
    const vendorByCode = new Map();
    for (const v of VENDORS) {
        const name = `Vendor ${v.code} (name pending)`;
        const row = await prisma.vendor.upsert({
            where: { code: v.code },
            update: { numericCode: v.numericCode, name },
            create: { id: (0, uuid_1.newId)(), code: v.code, numericCode: v.numericCode, name },
        });
        vendorByCode.set(v.code, row);
    }
    const vendorList = Array.from(vendorByCode.values());
    console.log(`Vendors: ${vendorByCode.size} seeded`);
    let barcodeSeq = 6280000100000; // arbitrary EAN13-ish sequence base
    function nextBarcode() {
        return String(barcodeSeq++);
    }
    const productSeeds = [
        {
            name: "Silk Evening Gown",
            nameAr: "فستان سهرة حريري",
            brand: "Qassemiya Couture",
            categoryId: dresses.id,
            variants: ["S", "M", "L"].map((size) => ({
                size,
                color: "Black",
                colorHex: "#000000",
                sku: `DRS-EVG-${size}-BLK`,
                barcode: nextBarcode(),
                costPrice: 150,
                sellingPrice: 399,
                initialQty: 15,
            })),
        },
        {
            name: "Floral Summer Dress",
            nameAr: "فستان صيفي منقوش",
            brand: "Qassemiya Casual",
            categoryId: dresses.id,
            variants: ["S", "M", "L"].map((size) => ({
                size,
                color: "Blush Pink",
                colorHex: "#F4C2C2",
                sku: `DRS-SUM-${size}-PNK`,
                barcode: nextBarcode(),
                costPrice: 60,
                sellingPrice: 159,
                initialQty: 25,
            })),
        },
        {
            name: "Embroidered Abaya",
            nameAr: "عباية مطرزة",
            brand: "Qassemiya Couture",
            categoryId: abayas.id,
            variants: ["S", "M", "L"].map((size) => ({
                size,
                color: "Black",
                colorHex: "#000000",
                sku: `ABY-EMB-${size}-BLK`,
                barcode: nextBarcode(),
                costPrice: 180,
                sellingPrice: 449,
                initialQty: 12,
            })),
        },
        {
            name: "Casual Kaftan",
            nameAr: "قفطان يومي",
            brand: "Qassemiya Casual",
            categoryId: abayas.id,
            variants: ["M", "L"].map((size) => ({
                size,
                color: "Navy",
                colorHex: "#1B1F3B",
                sku: `ABY-KAF-${size}-NVY`,
                barcode: nextBarcode(),
                costPrice: 90,
                sellingPrice: 229,
                initialQty: 20,
            })),
        },
        {
            name: "Leather Handbag",
            nameAr: "حقيبة يد جلدية",
            brand: "Qassemiya Accessories",
            categoryId: accessories.id,
            variants: [
                { color: "Black", colorHex: "#000000", sku: "ACC-BAG-BLK", barcode: nextBarcode(), costPrice: 120, sellingPrice: 299, initialQty: 10 },
                { color: "Tan", colorHex: "#D2B48C", sku: "ACC-BAG-TAN", barcode: nextBarcode(), costPrice: 120, sellingPrice: 299, initialQty: 10 },
            ],
        },
        {
            name: "Silk Scarf",
            nameAr: "وشاح حريري",
            brand: "Qassemiya Accessories",
            categoryId: accessories.id,
            variants: [
                { color: "Red", colorHex: "#B10F2E", sku: "ACC-SCF-RED", barcode: nextBarcode(), costPrice: 25, sellingPrice: 69, initialQty: 30 },
                { color: "Gold", colorHex: "#D4AF37", sku: "ACC-SCF-GLD", barcode: nextBarcode(), costPrice: 25, sellingPrice: 69, initialQty: 30 },
                { color: "Emerald", colorHex: "#046307", sku: "ACC-SCF-EMR", barcode: nextBarcode(), costPrice: 25, sellingPrice: 69, initialQty: 30 },
            ],
        },
    ];
    let productCount = 0;
    let variantCount = 0;
    const createdProducts = [];
    for (const p of productSeeds) {
        const existingProduct = await prisma.product.findFirst({ where: { name: p.name } });
        const product = existingProduct ??
            (await prisma.product.create({
                data: {
                    id: (0, uuid_1.newId)(),
                    name: p.name,
                    nameAr: p.nameAr,
                    brand: p.brand,
                    categoryId: p.categoryId,
                },
            }));
        productCount++;
        createdProducts.push(product);
        for (const v of p.variants) {
            const existingVariant = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
            const variant = existingVariant ??
                (await prisma.productVariant.create({
                    data: {
                        id: (0, uuid_1.newId)(),
                        productId: product.id,
                        sku: v.sku,
                        barcode: v.barcode,
                        barcodeType: "CODE128",
                        size: v.size,
                        color: v.color,
                        colorHex: v.colorHex,
                        costPrice: v.costPrice,
                        sellingPrice: v.sellingPrice,
                        taxRate: 15,
                    },
                }));
            variantCount++;
            if (!existingVariant) {
                // Real stock ledger entry, not a raw insert — exercises the same
                // path StockMovement/Inventory use everywhere else in the system.
                await prisma.$transaction((tx) => (0, stock_ledger_1.applyStockMovement)(tx, {
                    branchId: branch.id,
                    productVariantId: variant.id,
                    quantityChange: v.initialQty,
                    type: "INITIAL_STOCK",
                    referenceType: "SEED",
                    createdByUserId: adminUser.id,
                    note: "Initial stock from seed script",
                }));
            }
        }
    }
    console.log(`Products: ${productCount} seeded with ${variantCount} variants + initial stock movements`);
    // Round-robin assign a primary vendor to each demo product so
    // vendor-performance has non-empty, comparable data immediately.
    for (let i = 0; i < createdProducts.length; i++) {
        const vendor = vendorList[i % vendorList.length];
        await prisma.product.update({ where: { id: createdProducts[i].id }, data: { vendorId: vendor.id } });
    }
    console.log(`Products: vendor-tagged round-robin across ${vendorList.length} vendors`);
    // ---------- Opening balances ----------
    // Dr Cash starting float + Dr Inventory at Σ seeded cost×qty across the
    // demo products, Cr Owner's Equity. This closes a real gap: the
    // INITIAL_STOCK stock movements above have no GL counterpart of their
    // own and would otherwise leave 1100 Inventory permanently understated
    // by exactly this amount.
    const openingBalanceDescription = "Opening balances (seed)";
    const existingOpeningEntry = await prisma.journalEntry.findFirst({
        where: { sourceType: "MANUAL", description: openingBalanceDescription },
    });
    if (!existingOpeningEntry) {
        const cashStartingFloat = 15000;
        const seededInventoryValue = productSeeds
            .flatMap((p) => p.variants)
            .reduce((sum, v) => sum + v.costPrice * v.initialQty, 0);
        const [cashAccountId, inventoryAccountId, ownersEquityAccountId] = await Promise.all([
            prisma.account.findUniqueOrThrow({ where: { code: "1000" } }).then((a) => a.id),
            prisma.account.findUniqueOrThrow({ where: { code: "1100" } }).then((a) => a.id),
            prisma.account.findUniqueOrThrow({ where: { code: "3000" } }).then((a) => a.id),
        ]);
        await prisma.$transaction((tx) => (0, journal_ledger_1.postJournalEntry)(tx, {
            entryDate: new Date(),
            description: openingBalanceDescription,
            sourceType: "MANUAL",
            createdByUserId: adminUser.id,
            lines: [
                { accountId: cashAccountId, debit: cashStartingFloat, description: "Starting cash float" },
                { accountId: inventoryAccountId, debit: seededInventoryValue, description: "Seeded initial stock value" },
                {
                    accountId: ownersEquityAccountId,
                    credit: cashStartingFloat + seededInventoryValue,
                    description: "Owner's opening capital",
                },
            ],
        }));
        console.log(`Opening balances: Dr Cash ${cashStartingFloat} + Dr Inventory ${seededInventoryValue} / Cr Owner's Equity`);
    }
    else {
        console.log("Opening balances already seeded, skipping.");
    }
    // ---------- Demo purchasing cycle: PO -> partial goods receipt -> invoice -> partial payment ----------
    // So vendor-balances and /vendors/:id/statement are demoable without any manual setup.
    const demoVendor = vendorByCode.get("TN");
    const demoProduct = createdProducts[0];
    const demoVariant = await prisma.productVariant.findFirstOrThrow({ where: { productId: demoProduct.id } });
    const existingDemoPO = await prisma.purchaseOrder.findFirst({
        where: { vendorId: demoVendor.id, notes: "Seed demo cycle" },
    });
    if (!existingDemoPO) {
        const poId = (0, uuid_1.newId)();
        const poItemId = (0, uuid_1.newId)();
        const qtyOrdered = 20;
        const quotedUnitCost = Number(demoVariant.costPrice);
        const poSubtotal = qtyOrdered * quotedUnitCost;
        await prisma.purchaseOrder.create({
            data: {
                id: poId,
                vendorId: demoVendor.id,
                branchId: branch.id,
                createdByUserId: adminUser.id,
                status: "SUBMITTED",
                subtotal: poSubtotal,
                total: poSubtotal,
                notes: "Seed demo cycle",
                items: {
                    create: [
                        {
                            id: poItemId,
                            productVariantId: demoVariant.id,
                            quantityOrdered: qtyOrdered,
                            unitCost: quotedUnitCost,
                            lineTotal: poSubtotal,
                        },
                    ],
                },
            },
        });
        // Partial receipt (12 of 20 ordered) at a cost slightly above the PO's
        // quoted cost — exercises the last-cost-method ProductVariant.costPrice update.
        const qtyReceived = 12;
        const receivedUnitCost = quotedUnitCost + 5;
        const grId = (0, uuid_1.newId)();
        await prisma.$transaction(async (tx) => {
            await tx.goodsReceipt.create({
                data: {
                    id: grId,
                    purchaseOrderId: poId,
                    branchId: branch.id,
                    receivedByUserId: adminUser.id,
                    deliveryNoteRef: "SEED-DN-001",
                    items: {
                        create: [
                            {
                                id: (0, uuid_1.newId)(),
                                purchaseOrderItemId: poItemId,
                                productVariantId: demoVariant.id,
                                quantity: qtyReceived,
                                unitCost: receivedUnitCost,
                            },
                        ],
                    },
                },
            });
            await (0, stock_ledger_1.applyStockMovement)(tx, {
                branchId: branch.id,
                productVariantId: demoVariant.id,
                quantityChange: qtyReceived,
                type: "PURCHASE_RECEIVE",
                referenceType: "GOODS_RECEIPT",
                referenceId: grId,
                createdByUserId: adminUser.id,
            });
            await tx.purchaseOrderItem.update({
                where: { id: poItemId },
                data: { quantityReceived: { increment: qtyReceived } },
            });
            await tx.productVariant.update({ where: { id: demoVariant.id }, data: { costPrice: receivedUnitCost } });
            await tx.purchaseOrder.update({ where: { id: poId }, data: { status: "PARTIALLY_RECEIVED" } });
            // GL: Dr 1100 Inventory / Cr 2050 GRNI.
            const [inventoryAccountId, grniAccountId] = await Promise.all([
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "1100"),
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "2050"),
            ]);
            await (0, journal_ledger_1.postJournalEntry)(tx, {
                entryDate: new Date(),
                description: `Goods receipt ${grId}`,
                sourceType: "GOODS_RECEIPT",
                sourceId: grId,
                branchId: branch.id,
                createdByUserId: adminUser.id,
                lines: [
                    { accountId: inventoryAccountId, debit: qtyReceived * receivedUnitCost, description: "Inventory received" },
                    { accountId: grniAccountId, credit: qtyReceived * receivedUnitCost, description: "Goods received not invoiced" },
                ],
            });
        });
        // Invoice for the received portion, then a partial payment (half) so
        // vendor-balances shows a non-zero outstanding amount.
        const invoiceTotal = qtyReceived * receivedUnitCost;
        const invoiceId = (0, uuid_1.newId)();
        await prisma.$transaction(async (tx) => {
            await tx.purchaseInvoice.create({
                data: {
                    id: invoiceId,
                    vendorId: demoVendor.id,
                    purchaseOrderId: poId,
                    invoiceNumber: `${demoVendor.code}-INV-0001`,
                    subtotal: invoiceTotal,
                    total: invoiceTotal,
                    status: "PENDING",
                },
            });
            // GL: PO-linked invoice -> Dr 2050 GRNI (subtotal, taxTotal=0 here) / Cr 2000 AP.
            const [grniAccountId, apAccountId] = await Promise.all([
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "2050"),
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "2000"),
            ]);
            await (0, journal_ledger_1.postJournalEntry)(tx, {
                entryDate: new Date(),
                description: `Purchase invoice ${demoVendor.code}-INV-0001`,
                sourceType: "PURCHASE_INVOICE",
                sourceId: invoiceId,
                branchId: branch.id,
                lines: [
                    { accountId: grniAccountId, debit: invoiceTotal, description: "Clear GRNI" },
                    { accountId: apAccountId, credit: invoiceTotal, description: "Accounts payable" },
                ],
            });
        });
        const cashMethod = await prisma.paymentMethod.findUniqueOrThrow({ where: { code: shared_types_1.PaymentMethodCode.CASH } });
        const paymentAmount = Math.round((invoiceTotal / 2) * 100) / 100;
        const vendorPaymentId = (0, uuid_1.newId)();
        await prisma.$transaction(async (tx) => {
            await tx.vendorPayment.create({
                data: {
                    id: vendorPaymentId,
                    vendorId: demoVendor.id,
                    purchaseInvoiceId: invoiceId,
                    paymentMethodId: cashMethod.id,
                    amount: paymentAmount,
                },
            });
            await tx.purchaseInvoice.update({ where: { id: invoiceId }, data: { status: "PARTIALLY_PAID" } });
            // GL: Dr 2000 Accounts Payable / Cr the payment method's mapped account (1000 Cash).
            const [apAccountId, cashAccountId] = await Promise.all([
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "2000"),
                (0, journal_ledger_1.resolvePaymentAccountId)(tx, cashMethod.id),
            ]);
            await (0, journal_ledger_1.postJournalEntry)(tx, {
                entryDate: new Date(),
                description: `Vendor payment to ${demoVendor.name}`,
                sourceType: "VENDOR_PAYMENT",
                sourceId: vendorPaymentId,
                lines: [
                    { accountId: apAccountId, debit: paymentAmount, description: "Accounts payable settled" },
                    { accountId: cashAccountId, credit: paymentAmount, description: "Payment out" },
                ],
            });
        });
        console.log(`Demo purchasing cycle: PO ${poId} -> GR ${grId} -> Invoice ${invoiceId} -> Payment ${vendorPaymentId} seeded for vendor ${demoVendor.code}`);
    }
    else {
        console.log("Demo purchasing cycle already seeded, skipping.");
    }
    // ---------- Demo sales: split CASH/CARD payments ----------
    // Built the same direct-Prisma-plus-applyStockMovement way as the rest of
    // this script, now also posting GL exactly like SalesService.createSaleTx.
    // Guarded by a fixed `notes` marker (matching the "Seed demo cycle" idiom
    // above) so re-running the seed script doesn't double-post sales.
    const cashPaymentMethod = await prisma.paymentMethod.findUniqueOrThrow({ where: { code: shared_types_1.PaymentMethodCode.CASH } });
    const cardPaymentMethod = await prisma.paymentMethod.findUniqueOrThrow({ where: { code: shared_types_1.PaymentMethodCode.CARD } });
    async function seedDemoSale(seed) {
        const existing = await prisma.order.findFirst({ where: { notes: seed.marker } });
        if (existing)
            return existing.id;
        const variants = await Promise.all(seed.lines.map((line) => prisma.productVariant.findUniqueOrThrow({ where: { sku: line.sku } })));
        const items = variants.map((variant, i) => {
            const quantity = seed.lines[i].quantity;
            const unitPrice = Number(variant.sellingPrice);
            const subtotal = unitPrice * quantity;
            const taxAmount = Math.round(subtotal * (Number(variant.taxRate) / 100) * 100) / 100;
            const lineTotal = Math.round((subtotal + taxAmount) * 100) / 100;
            return {
                productVariantId: variant.id,
                quantity,
                unitPrice,
                discountAmount: 0,
                taxAmount,
                lineTotal,
                costPriceSnapshot: Number(variant.costPrice),
            };
        });
        const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const taxTotal = Math.round(items.reduce((sum, i) => sum + i.taxAmount, 0) * 100) / 100;
        const total = Math.round((subtotal + taxTotal) * 100) / 100;
        const orderId = (0, uuid_1.newId)();
        const payments = seed.paymentSplits.map((split, i) => ({
            paymentMethodId: split.paymentMethodId,
            amount: i === seed.paymentSplits.length - 1
                ? Math.round((total - seed.paymentSplits.slice(0, i).reduce((sum, s) => sum + Math.round(total * s.ratio * 100) / 100, 0)) * 100) / 100
                : Math.round(total * split.ratio * 100) / 100,
        }));
        await prisma.$transaction(async (tx) => {
            await tx.order.create({
                data: {
                    id: orderId,
                    branchId: branch.id,
                    cashierUserId: cashier1.id,
                    source: "POS",
                    subtotal,
                    discountTotal: 0,
                    taxTotal,
                    total,
                    notes: seed.marker,
                    items: { create: items.map((i) => ({ id: (0, uuid_1.newId)(), ...i })) },
                    payments: {
                        create: payments.map((p) => ({ id: (0, uuid_1.newId)(), paymentMethodId: p.paymentMethodId, amount: p.amount })),
                    },
                },
            });
            for (const item of items) {
                await (0, stock_ledger_1.applyStockMovement)(tx, {
                    branchId: branch.id,
                    productVariantId: item.productVariantId,
                    quantityChange: -item.quantity,
                    type: "SALE",
                    referenceType: "ORDER",
                    referenceId: orderId,
                    createdByUserId: cashier1.id,
                });
            }
            // GL posting — same formula as SalesService.createSaleTx: Dr each
            // payment's mapped account · Cr 4000 Sales Revenue · Cr 2100 VAT
            // Payable · Dr 5000 COGS / Cr 1100 Inventory at cost snapshot.
            const [salesRevenueAccountId, vatPayableAccountId, cogsAccountId, inventoryAccountId] = await Promise.all([
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "4000"),
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "2100"),
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "5000"),
                (0, journal_ledger_1.resolveAccountIdByCode)(tx, "1100"),
            ]);
            const lines = [];
            for (const payment of payments) {
                const accountId = await (0, journal_ledger_1.resolvePaymentAccountId)(tx, payment.paymentMethodId);
                lines.push({ accountId, debit: payment.amount, description: "Sale payment" });
            }
            lines.push({ accountId: salesRevenueAccountId, credit: subtotal, description: "Sale revenue" });
            if (taxTotal > 0)
                lines.push({ accountId: vatPayableAccountId, credit: taxTotal, description: "VAT collected" });
            const cogsTotal = Math.round(items.reduce((sum, i) => sum + i.costPriceSnapshot * i.quantity, 0) * 100) / 100;
            if (cogsTotal > 0) {
                lines.push({ accountId: cogsAccountId, debit: cogsTotal, description: "Cost of goods sold" });
                lines.push({ accountId: inventoryAccountId, credit: cogsTotal, description: "Inventory reduction" });
            }
            await (0, journal_ledger_1.postJournalEntry)(tx, {
                entryDate: new Date(),
                description: `Sale ${orderId}`,
                sourceType: "SALE",
                sourceId: orderId,
                branchId: branch.id,
                createdByUserId: cashier1.id,
                lines,
            });
        });
        return orderId;
    }
    const demoSale1Id = await seedDemoSale({
        marker: "Seed demo sale #1",
        lines: [
            { sku: "DRS-EVG-M-BLK", quantity: 1 },
            { sku: "DRS-SUM-S-PNK", quantity: 2 },
        ],
        paymentSplits: [
            { paymentMethodId: cashPaymentMethod.id, ratio: 0.6 },
            { paymentMethodId: cardPaymentMethod.id, ratio: 0.4 },
        ],
    });
    const demoSale2Id = await seedDemoSale({
        marker: "Seed demo sale #2",
        lines: [{ sku: "ABY-EMB-M-BLK", quantity: 1 }],
        paymentSplits: [{ paymentMethodId: cardPaymentMethod.id, ratio: 1 }],
    });
    const demoSale3Id = await seedDemoSale({
        marker: "Seed demo sale #3",
        lines: [
            { sku: "ACC-SCF-RED", quantity: 2 },
            { sku: "ACC-BAG-BLK", quantity: 1 },
        ],
        paymentSplits: [
            { paymentMethodId: cashPaymentMethod.id, ratio: 0.25 },
            { paymentMethodId: cardPaymentMethod.id, ratio: 0.75 },
        ],
    });
    console.log(`Demo sales: ${demoSale1Id}, ${demoSale2Id}, ${demoSale3Id} seeded with split CASH/CARD payments + GL postings`);
    console.log("\n=== Seeded login credentials ===");
    for (const c of credentials) {
        console.log(`  ${c.label.padEnd(16)} ${c.email.padEnd(28)} ${c.password}`);
    }
    console.log("=================================\n");
    console.log("Seed complete.");
}
main()
    .catch((err) => {
    console.error(err);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map