import { type SelectHTMLAttributes, forwardRef } from "react";
import type { FieldError } from "react-hook-form";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: FieldError;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, className = "", id, children, ...rest }, ref) => {
    const selectId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 ${
            error ? "border-red-400" : "border-slate-300"
          } ${className}`}
          {...rest}
        >
          {children}
        </select>
        {error && <span className="text-xs text-red-600">{error.message}</span>}
      </div>
    );
  },
);
SelectField.displayName = "SelectField";
