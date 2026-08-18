import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { downloadCsv } from "@/lib/csv";
import { downloadXlsx } from "@/lib/exportXlsx";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

interface ExportMenuProps {
  /** Button label; defaults to the generic "Export" translation. */
  label?: string;
  disabled?: boolean;
  /** Base filename, no extension — each format appends its own. */
  filename: string;
  /** Worksheet name for the .xlsx file; defaults to filename. */
  sheetName?: string;
  rows: Record<string, unknown>[];
  /**
   * Maps a row's raw object keys (e.g. "unitsSold") to the human/translated
   * column label to actually display (e.g. "Units sold" / "الوحدات
   * المباعة"). Without this, exports show the raw camelCase key as-is.
   */
  headers?: Record<string, string>;
}

function remapHeaders(
  rows: Record<string, unknown>[],
  headers?: Record<string, string>,
): Record<string, unknown>[] {
  if (!headers) return rows;
  return rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      next[headers[key] ?? key] = value;
    }
    return next;
  });
}

/** Dropdown replacement for a plain "Export CSV" button — same row data, two output formats. */
export function ExportMenu({ label, disabled, filename, sheetName, rows, headers }: ExportMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isDisabled = disabled || rows.length === 0;

  async function handle(format: "csv" | "xlsx") {
    setOpen(false);
    setBusy(true);
    try {
      const displayRows = remapHeaders(rows, headers);
      if (format === "csv") {
        downloadCsv(`${filename}.csv`, displayRows);
      } else {
        await downloadXlsx(`${filename}.xlsx`, sheetName ?? filename, displayRows);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t("common.exportFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <Button
        type="button"
        variant="secondary"
        disabled={isDisabled || busy}
        isLoading={busy}
        onClick={() => setOpen((o) => !o)}
      >
        {(label ?? t("common.export")) + " ▾"}
      </Button>
      {open && (
        // `end-0` (logical), not `right-0` — the trigger button typically
        // sits at the far edge of a flex `justify-between` row, which flips
        // sides under `dir="rtl"`. A physical `right-0` kept anchoring the
        // menu to the button's outer edge instead of following that flip,
        // so in RTL it opened further off the left edge of the button
        // instead of back over the content, running off-screen.
        <div className="absolute end-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => void handle("csv")}
          >
            {t("common.exportCsv")}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => void handle("xlsx")}
          >
            {t("common.exportExcel")}
          </button>
        </div>
      )}
    </div>
  );
}
