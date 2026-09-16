import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getOnlineSalesTrend, getSalesSummary, getSalesTrend } from "@/api/reports";
import { useAuthStore } from "@/store/authStore";
import { DataState } from "@/components/ui/DataState";
import { useHasPermission } from "@/hooks/useHasPermission";
import { useUrlState } from "@/hooks/useUrlState";

type PresetKey = "today" | "yesterday" | "last7" | "last30" | "last90" | "last365" | "custom";

const PRESET_KEYS: { key: PresetKey; labelKey: string }[] = [
  { key: "today", labelKey: "dashboard.presetToday" },
  { key: "yesterday", labelKey: "dashboard.presetYesterday" },
  { key: "last7", labelKey: "dashboard.presetLastWeek" },
  { key: "last30", labelKey: "dashboard.presetLastMonth" },
  { key: "last90", labelKey: "dashboard.presetLastQuarter" },
  { key: "last365", labelKey: "dashboard.presetLastYear" },
  { key: "custom", labelKey: "dashboard.presetCustom" },
];

// The viewer's local calendar date as "YYYY-MM-DD" -- what every date-picker
// elsewhere in the app also sends. The API resolves this to the correct
// Riyadh-local day boundary itself (see date-range.ts server-side); the
// upper bound only ever needs to round up to end-of-day rather than the
// exact current moment, since a sale can never have a future createdAt, so
// rounding it changes nothing about which rows match.
function localIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Resolves a preset key into a concrete [from, to] range, anchored to "now" at call time. */
function resolvePresetRange(preset: PresetKey, now: Date): { from: string; to: string } {
  switch (preset) {
    case "today":
      return { from: localIsoDate(now), to: localIsoDate(now) };
    case "yesterday": {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return { from: localIsoDate(y), to: localIsoDate(y) };
    }
    case "last7":
      return { from: localIsoDate(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)), to: localIsoDate(now) };
    case "last30":
      return { from: localIsoDate(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)), to: localIsoDate(now) };
    case "last90":
      return { from: localIsoDate(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000)), to: localIsoDate(now) };
    case "last365":
      return { from: localIsoDate(new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000)), to: localIsoDate(now) };
    default:
      return { from: localIsoDate(now), to: localIsoDate(now) };
  }
}

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const PIE_COLORS = ["#0f172a", "#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

export function DashboardPage() {
  const { t } = useTranslation();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const canViewOnlineSales = useHasPermission("reports.channel.view");
  const [preset, setPreset] = useUrlState("preset", "last7");

  // Anchored once per mount so a rolling-window preset doesn't recompute a
  // new `to` on every render — that previously churned the query key into
  // an infinite refetch loop that never stabilized out of "loading".
  const now = useMemo(() => new Date(), []);
  const [customFrom, setCustomFrom] = useUrlState("from", isoDate(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)));
  const [customTo, setCustomTo] = useUrlState("to", isoDate(now));

  const { from, to } = preset === "custom" ? { from: customFrom, to: customTo } : resolvePresetRange(preset as PresetKey, now);

  const summaryQuery = useQuery({
    queryKey: ["reports", "sales-summary", activeBranchId, from, to],
    queryFn: () => getSalesSummary({ branchId: activeBranchId ?? undefined, from, to }),
  });

  const trendQuery = useQuery({
    queryKey: ["reports", "sales-trend", activeBranchId, from, to],
    queryFn: () => getSalesTrend({ branchId: activeBranchId ?? undefined, from, to }),
  });

  const onlineTrendQuery = useQuery({
    queryKey: ["reports", "online-sales-trend", from, to],
    queryFn: () => getOnlineSalesTrend({ from, to }),
    enabled: canViewOnlineSales,
  });

  const trendData = trendQuery.data?.days.map((d) => ({ ...d, label: shortDate(d.date) })) ?? [];
  const onlineTrendData = onlineTrendQuery.data?.days.map((d) => ({ ...d, label: shortDate(d.date) })) ?? [];
  const paymentMethodData = summaryQuery.data?.byPaymentMethod.filter((p) => p.amount > 0) ?? [];
  const periodLabel = t(PRESET_KEYS.find((p) => p.key === preset)?.labelKey ?? "dashboard.presetToday");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PresetKey)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          >
            {PRESET_KEYS.map((p) => (
              <option key={p.key} value={p.key}>
                {t(p.labelKey)}
              </option>
            ))}
          </select>
          {preset === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              />
              <span className="text-sm text-slate-500">{t("common.to")}</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{t("dashboard.sales", { period: periodLabel })}</p>
          <DataState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError} error={summaryQuery.error}>
            <p className="mt-1 text-2xl font-bold text-slate-900">{currency(summaryQuery.data?.total ?? 0)}</p>
          </DataState>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{t("dashboard.orders", { period: periodLabel })}</p>
          <DataState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError} error={summaryQuery.error}>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summaryQuery.data?.orderCount ?? 0}</p>
          </DataState>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">{t("dashboard.taxCollected", { period: periodLabel })}</p>
          <DataState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError} error={summaryQuery.error}>
            <p className="mt-1 text-2xl font-bold text-slate-900">{currency(summaryQuery.data?.taxTotal ?? 0)}</p>
          </DataState>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("dashboard.salesTrend", { period: periodLabel })}</h2>
          <DataState
            isLoading={trendQuery.isLoading}
            isError={trendQuery.isError}
            error={trendQuery.error}
            isEmpty={trendData.every((d) => d.total === 0)}
            emptyMessage={t("dashboard.emptyTrend")}
          >
            {/* recharts has no RTL support — its axis-width math assumes
                LTR, so under the page's dir="rtl" the Y-axis labels overlap
                the bars instead of reserving space for themselves. Isolating
                the chart canvas back to LTR keeps it rendering correctly
                regardless of the active UI language. */}
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} width={70} tickFormatter={(v) => currency(v)} />
                  <Tooltip
                    formatter={(value) => currency(Number(value ?? 0))}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="total" name="Sales" fill="#0f172a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DataState>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("dashboard.salesByPaymentMethod", { period: periodLabel })}</h2>
          <DataState
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
            error={summaryQuery.error}
            isEmpty={paymentMethodData.length === 0}
            emptyMessage={t("dashboard.emptyPayments")}
          >
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {paymentMethodData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DataState>
        </div>
      </div>

      {canViewOnlineSales && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            {t("dashboard.onlineSalesTrend", { period: periodLabel })}
          </h2>
          <DataState
            isLoading={onlineTrendQuery.isLoading}
            isError={onlineTrendQuery.isError}
            error={onlineTrendQuery.error}
            isEmpty={onlineTrendData.every((d) => d.total === 0)}
            emptyMessage={t("dashboard.emptyOnlineTrend")}
          >
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={onlineTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} width={70} tickFormatter={(v) => currency(v)} />
                  <Tooltip
                    formatter={(value) => currency(Number(value ?? 0))}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="total" name="Online sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DataState>
        </div>
      )}
    </div>
  );
}
