#!/usr/bin/env node
/**
 * scripts/contraste.mjs
 * Calcula la razón de contraste WCAG 2.1 de todos los pares texto/fondo
 * usados en src/theme/tokens.ts (claro y oscuro).
 *
 * WCAG AA: ≥ 4.5:1 para texto normal, ≥ 3:1 para texto grande (≥ 18px o ≥ 14px bold).
 *
 * Uso: node scripts/contraste.mjs
 * Salta con exit code 1 si hay pares que no pasan AA.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensPath = join(__dirname, '..', 'src', 'theme', 'tokens.ts');

// ---------------------------------------------------------------------------
// Extraer valores de color del fichero tokens.ts
// ---------------------------------------------------------------------------
const tokensSrc = readFileSync(tokensPath, 'utf8');

const hexMap = new Map();
for (const [, key, _, value] of tokensSrc.matchAll(
  /(\w+):\s*'(#(?:[0-9a-fA-F]{3}){1,2}|rgba?\([^)]+\))'/g
)) {
  hexMap.set(key, value);
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

function rgbaToRgb(rgba) {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function toRgb(str) {
  if (str.startsWith('#')) return hexToRgb(str);
  return rgbaToRgb(str);
}

// Luminancia relativa relativa (WCAG 2.1 §3)
function relativeLuminance(rgb) {
  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(toRgb(c1));
  const l2 = relativeLuminance(toRgb(c2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Pares a verificar (texto sobre fondo) — los usados realmente en la app
// ---------------------------------------------------------------------------
const PAIRS = [
  // Texto principal
  { fg: 'ink', bg: 'bg', label: 'ink / bg' },
  { fg: 'ink', bg: 'card', label: 'ink / card' },
  // Texto sobre ink (onInk)
  { fg: 'onInk', bg: 'ink', label: 'onInk / ink' },
  // Texto secundario
  { fg: 'mut', bg: 'card', label: 'mut / card (AA ≥ 4.5:1)' },
  { fg: 'textSecondary', bg: 'card', label: 'textSecondary / card (AA ≥ 4.5:1)' },
  // Acento
  { fg: 'acc', bg: 'accSoft', label: 'acc / accSoft (AA ≥ 4.5:1)' },
  { fg: 'onAcc', bg: 'acc', label: 'onAcc / acc' },
  // Negativo
  { fg: 'neg', bg: 'negBg', label: 'neg / negBg (AA ≥ 4.5:1)' },
  // Warn
  { fg: 'warn', bg: 'warnBg', label: 'warn / warnBg (AA ≥ 4.5:1)' },
  // Líneas (no son texto, solo info)
  { fg: 'line', bg: 'bg', label: 'line / bg (info)' },
  { fg: 'chip', bg: 'bg', label: 'chip / bg (info)' },
];

function checkTheme(themeName, theme) {
  const results = [];
  for (const pair of PAIRS) {
    const fg = theme[pair.fg];
    const bg = theme[pair.bg];
    if (!fg || !bg) {
      results.push({ ...pair, ok: null, ratio: null, missing: `${pair.fg}=${fg} / ${pair.bg}=${bg}` });
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    const isInfo = pair.label.includes('(info)');
    const threshold = isInfo ? 1 : 4.5;
    const ok = ratio >= threshold;
    results.push({ ...pair, ok, ratio, fg, bg });
  }
  return results;
}

// Los temas están definidos como `export const light = { ... }` y `export const dark = { ... }`.
const lightMatch = tokensSrc.match(/export\s+const\s+light\s*=\s*\{([\s\S]*?)\n\}/);
const darkMatch = tokensSrc.match(/export\s+const\s+dark\s*=\s*\{([\s\S]*?)\n\}/);

if (!lightMatch || !darkMatch) {
  console.error('ERROR: No se encontraron los temas light/dark en tokens.ts');
  console.error('Buscando: export const light = { ... }');
  process.exit(1);
}

const lightTheme = {};
const darkTheme = {};

for (const [, key, value] of lightMatch[1].matchAll(/(\w+):\s*'([^']+)'/g)) {
  lightTheme[key] = value;
}
for (const [, key, value] of darkMatch[1].matchAll(/(\w+):\s*'([^']+)'/g)) {
  darkTheme[key] = value;
}

let exitCode = 0;
const allFailures = [];

for (const [themeName, theme] of [['CLARO', lightTheme], ['OSCURO', darkTheme]]) {
  console.log(`\n=== Tema ${themeName} ===`);
  const results = checkTheme(themeName, theme);
  let failed = 0;
  for (const r of results) {
    if (r.missing) {
      console.log(`  ? ${r.label} → FALTA ${r.missing}`);
      failed++;
      continue;
    }
    const emoji = r.ok ? '✓' : '✗';
    const status = r.ok ? 'PASS' : 'FAIL';
    console.log(`  ${emoji} ${r.label}: ${r.ratio.toFixed(2)}:1 ${status} (${r.fg} sobre ${r.bg})`);
    if (!r.ok) {
      failed++;
      allFailures.push(`[${themeName}] ${r.label}: ${r.ratio.toFixed(2)}:1`);
    }
  }
  console.log(`  ${failed === 0 ? '✓ Todos OK' : `✗ ${failed} fallos`}`);
  if (failed > 0) exitCode = 1;
}

if (exitCode === 0) {
  console.log('\n✓ Contraste WCAG AA: todos los pares superan 4.5:1.');
} else {
  console.log('\n✗ Contraste WCAG AA: hay pares que no superan 4.5:1:');
  for (const f of allFailures) console.log(`  ${f}`);
}

process.exit(exitCode);
