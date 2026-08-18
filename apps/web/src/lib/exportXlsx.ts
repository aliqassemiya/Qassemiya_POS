import { downloadBlob } from "./downloadBlob";

/**
 * One formatted worksheet per call — bold header row, light-grey fill,
 * auto-sized columns. exceljs is dynamically imported so its ~1MB doesn't
 * sit in the main bundle for users who never click "Export".
 */
export async function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31)); // Excel sheet-name length limit

  const headers = Object.keys(rows[0]);
  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.min(40, Math.max(12, h.length + 4)),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF1F2430" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF0F4" } };
  headerRow.alignment = { vertical: "middle" };

  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ""));
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    filename,
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
}
