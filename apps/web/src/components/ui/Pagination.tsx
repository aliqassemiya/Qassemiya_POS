import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

/** Shared Prev/Next pager for any list backed by a {data, totalCount} response — keeps every list page's pagination UI/behavior consistent. */
export function Pagination({ page, pageSize, totalCount, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  if (totalCount === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>{t("common.pageOfTotal", { page, totalPages, count: totalCount })}</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t("common.previous")}
        </Button>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}
