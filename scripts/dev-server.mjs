import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const logPath = join(rootDir, "..", "debug-ed619f.log");

function agentLog(message, data, hypothesisId) {
  // #region agent log
  const entry = {
    sessionId: "ed619f",
    timestamp: Date.now(),
    location: "scripts/dev-server.mjs",
    message,
    data,
    hypothesisId,
    runId: process.env.DEBUG_RUN_ID ?? "pre-fix",
  };
  try {
    appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
    fetch("http://127.0.0.1:7628/ingest/5119f2b2-1b6e-40e1-879b-56b7964a1a99", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ed619f",
      },
      body: JSON.stringify(entry),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  // #endregion
}

const cwd = process.cwd();
const env = {
  ...process.env,
  WATCHPACK_POLLING: "true",
  CHOKIDAR_USEPOLLING: "true",
  CHOKIDAR_INTERVAL: "1000",
};

agentLog("dev-server spawn", {
  cwd,
  cwdLength: cwd.length,
  hasNonAsciiPath: /[^\u0000-\u007f]/.test(cwd),
  hasRtlMark: cwd.includes("\u200e") || cwd.includes("\u200f"),
  watchpackPolling: env.WATCHPACK_POLLING,
  chokidarPolling: env.CHOKIDAR_USEPOLLING,
  nodeVersion: process.version,
}, "H1");

const child = spawn("npx", ["next", "dev", "--webpack"], {
  cwd,
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code, signal) => {
  agentLog("dev-server exit", { code, signal }, "H4");
  process.exit(code ?? 1);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
