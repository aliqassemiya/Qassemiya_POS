import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// Local dev always works without any config; CORS_ORIGINS (comma-separated,
// exact origins e.g. "https://dev.shalkyqq.com,https://shalkyqq.com") adds
// whatever the deployed dashboard is actually served from.
function resolveAllowedOrigins(): (string | RegExp)[] {
  const localhost = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
  const configured = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...localhost, ...configured];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: resolveAllowedOrigins(),
    credentials: true,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Qassemiya API listening on http://localhost:${port}`);
}

bootstrap();
