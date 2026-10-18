import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";

/** Unauthenticated liveness check — used by Docker, and later the ALB, to confirm the process is up. */
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok" };
  }
}
