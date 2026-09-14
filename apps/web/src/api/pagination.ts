/** Shared response shape for every paginated list endpoint. */
export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
}
