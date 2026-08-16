import { type InputHTMLAttributes, forwardRef } from "react";
import type { FieldError } from "react-hook-form";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, className = "", id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 ${
            error ? "border-red-400" : "border-slate-300"
          } ${className}`}
          {...rest}
        />
        {error && <span className="text-xs text-red-600">{error.message}</span>}
      </div>
    );
  },
);
TextField.displayName = "TextField";
