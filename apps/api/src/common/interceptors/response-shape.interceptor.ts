import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Prisma } from "../../../generated/prisma";

/**
 * Two global response-shaping fixes applied to every endpoint, so no
 * individual controller/service has to remember either:
 *
 * 1. Prisma's Decimal serializes to a JSON *string* via its own toJSON(),
 *    not a number — every money/tax field would otherwise silently arrive
 *    as a string on the wire even though every client-side type declares
 *    it a `number`.
 * 2. Every client (web, POS) consistently expects a product variant
 *    relation to be called `variant`, not `productVariant` — `variant` is
 *    the naming both frontends were independently built against. Renaming
 *    here (rather than in every Prisma `include`, which can't alias keys
 *    anyway) keeps one convention without a wrapper object per service.
 */
function transform(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(transform);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      const outKey = key === "productVariant" ? "variant" : key;
      out[outKey] = transform(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class ResponseShapeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => transform(data)));
  }
}
