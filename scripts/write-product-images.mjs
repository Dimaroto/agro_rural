import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "products");
mkdirSync(outDir, { recursive: true });

function svg(label, emoji, bg, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bg}"/>
      <stop offset="100%" style="stop-color:${accent}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#g)"/>
  <circle cx="100" cy="78" r="40" fill="rgba(255,255,255,0.2)"/>
  <text x="100" y="88" text-anchor="middle" font-size="36">${emoji}</text>
  <text x="100" y="155" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="#fff">${label}</text>
</svg>`;
}

const images = [
  ["sabonete-barra", "Sabonete barra", "🧼", "#7c3aed", "#a78bfa"],
  ["sabonete-liquido", "Sabonete líquido", "🫧", "#2563eb", "#60a5fa"],
  ["sabonete-glicerina", "Glicerina", "✨", "#0891b2", "#22d3ee"],
  ["sabonete-esfoliante", "Esfoliante", "🌿", "#15803d", "#4ade80"],
  ["sabonete-infantil", "Infantil", "🧸", "#db2777", "#f472b6"],
  ["sabonete-karite", "Karité", "🥥", "#92400e", "#d97706"],
  ["sache-lavanda", "Lavanda", "💜", "#6d28d9", "#a78bfa"],
  ["sache-floral", "Floral", "🌸", "#be185d", "#f472b6"],
  ["sache-citrico", "Cítrico", "🍋", "#ca8a04", "#facc15"],
  ["sache-roupa", "Roupa", "👕", "#0369a1", "#38bdf8"],
  ["sache-armario", "Armário", "🗄️", "#4b5563", "#9ca3af"],
  ["sache-bambu", "Bambu", "🎋", "#166534", "#4ade80"],
  ["spray-ambiente", "Ambiente", "🏠", "#0d9488", "#2dd4bf"],
  ["spray-tecido", "Tecido", "🛋️", "#7c2d12", "#ea580c"],
  ["spray-carro", "Carro", "🚗", "#1e40af", "#3b82f6"],
  ["spray-eucalipto", "Eucalipto", "🌿", "#14532d", "#22c55e"],
  ["spray-jasmim", "Jasmim", "🌼", "#a16207", "#fbbf24"],
  ["spray-linho", "Linho", "🧺", "#475569", "#94a3b8"],
];

for (const [file, label, emoji, bg, accent] of images) {
  writeFileSync(join(outDir, `${file}.svg`), svg(label, emoji, bg, accent));
}

console.log(`Geradas ${images.length} imagens em public/products/`);
