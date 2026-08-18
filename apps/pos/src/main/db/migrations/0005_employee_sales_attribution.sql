CREATE TABLE IF NOT EXISTS employee (
  id TEXT PRIMARY KEY,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE "order" ADD COLUMN sold_by_employee_id TEXT;
