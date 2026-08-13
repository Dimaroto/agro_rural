import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "dist", "hostgator");
const standaloneDir = path.join(root, ".next", "standalone");
const includeDb = process.argv.includes("--with-db");

function log(message) {
  console.log(`[hostgator] ${message}`);
}

function run(command) {
  execSync(command, { cwd: root, stdio: "inherit", env: process.env });
}

log("Gerando Prisma Client e build Next.js (standalone)...");
run("npx prisma generate");
run("npx next build");

if (!existsSync(standaloneDir)) {
  throw new Error(
    "Build standalone nao encontrado em .next/standalone. Verifique output: 'standalone' no next.config.ts."
  );
}

log("Montando pacote em dist/hostgator...");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(standaloneDir, outDir, { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(outDir, ".next", "static"), {
  recursive: true,
});
cpSync(path.join(root, "public"), path.join(outDir, "public"), { recursive: true });
cpSync(path.join(root, "prisma"), path.join(outDir, "prisma"), { recursive: true });

mkdirSync(path.join(outDir, "data"), { recursive: true });
mkdirSync(path.join(outDir, "public", "uploads"), { recursive: true });
writeFileSync(path.join(outDir, "public", "uploads", ".gitkeep"), "");

// Nunca enviar .env local no pacote de deploy
const envPath = path.join(outDir, ".env");
if (existsSync(envPath)) {
  rmSync(envPath);
}

const deployFiles = path.join(root, "deploy", "hostgator");
cpSync(path.join(deployFiles, "env.production.example"), path.join(outDir, "env.example"));
cpSync(path.join(deployFiles, ".htaccess"), path.join(outDir, ".htaccess"));
cpSync(path.join(deployFiles, "HOSTGATOR-LEIA-ME.md"), path.join(outDir, "HOSTGATOR-LEIA-ME.md"));

const devDb = path.join(root, "prisma", "dev.db");
if (includeDb && existsSync(devDb)) {
  cpSync(devDb, path.join(outDir, "data", "catalogo.db"));
  log("Banco local copiado para data/catalogo.db (--with-db).");
} else if (includeDb) {
  log("Aviso: --with-db informado, mas prisma/dev.db nao existe. Rode npm run db:seed antes.");
}

const packageJsonPath = path.join(outDir, "package.json");
if (existsSync(packageJsonPath)) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  pkg.scripts = {
    ...(pkg.scripts ?? {}),
    start: "node server.js",
    "db:push": "prisma db push --schema=./prisma/schema.prisma",
  };
  pkg.engines = {
    node: ">=20.9.0",
  };
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

log("Pacote pronto em dist/hostgator");
log("Proximo passo: envie a pasta dist/hostgator para a HostGator e siga HOSTGATOR-LEIA-ME.md");
