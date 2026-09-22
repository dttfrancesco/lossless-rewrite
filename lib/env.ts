import { existsSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

/** Load `.env.local`, then `.env`, into `process.env` for CLI scripts. Next.js does this itself. */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  for (const name of [".env.local", ".env"]) {
    const file = resolve(process.cwd(), name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
