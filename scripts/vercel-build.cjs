/**
 * Build na Vercel: mapeia env do Neon e gera o client Prisma antes do next build.
 */
const { execSync } = require("child_process");
const { applyNeonEnv } = require("./neon-env.cjs");

applyNeonEnv();

execSync("npx prisma generate && npx next build", {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
