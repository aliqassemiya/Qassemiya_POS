import { useSearchParams } from "react-router-dom";

/**
 * Drop-in replacement for `useState(defaultValue)` that stores the value in
 * the URL's query string instead of component state — so a filter survives
 * a page refresh, and the URL itself is a shareable, readable description
 * of what's being viewed. `replace: true` so paging through filter changes
 * doesn't spam browser history with a back-button entry per keystroke.
 */
export function useUrlState(key: string, defaultValue = ""): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? defaultValue;

  const setValue = (next: string) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set(key, next);
        else params.delete(key);
        return params;
      },
      { replace: true },
    );
  };

  return [value, setValue];
}

/** Same idea, for a numeric filter (e.g. page number). */
export function useUrlNumberState(key: string, defaultValue: number): [number, (value: number) => void] {
  const [raw, setRaw] = useUrlState(key, String(defaultValue));
  const value = Number(raw) || defaultValue;
  const setValue = (next: number) => setRaw(next === defaultValue ? "" : String(next));
  return [value, setValue];
}

/** Same idea, for a boolean filter (e.g. a checkbox toggle). */
export function useUrlBooleanState(key: string, defaultValue = false): [boolean, (value: boolean) => void] {
  const [raw, setRaw] = useUrlState(key, defaultValue ? "true" : "");
  const value = raw === "true";
  const setValue = (next: boolean) => setRaw(next ? "true" : "");
  return [value, setValue];
}
