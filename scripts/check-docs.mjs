#!/usr/bin/env node
// scripts/check-docs.mjs — asserts policy + design system docs are present with required content.
// Run from repo root: `node scripts/check-docs.mjs`
// Exit 0 = all pass, 1 = any failure (one line per failure printed to stderr).
//
// Phase 1 — policy docs (ANTICHEAT-SAFETY, mojang-asset-policy, cape-provenance).
// Phase 4 — design system doc (UI-07): docs/DESIGN-SYSTEM.md structural + literal validator.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---- Phase 1 policy docs — plain substring checks (original Phase 1 contract) ----
const substringChecks = [
  {
    file: 'docs/ANTICHEAT-SAFETY.md',
    required: [
      '# WiiWho Anticheat Safety Review',
      '## Feature Review Log',
      '## Alt-Account Play Tests',
      '### Hypixel',
      '### BlocksMC',
      '## Red Lines',
    ],
  },
  {
    file: 'docs/mojang-asset-policy.md',
    required: [
      '# WiiWho Client — Mojang Asset Policy',
      '## Policy',
      'downloads at runtime',
    ],
  },
  {
    file: 'docs/cape-provenance.md',
    required: [
      '# Placeholder Cape — Provenance',
      '## Provenance',
      'original art',
    ],
  },
];

// ---- Phase 4 UI-07 — DESIGN-SYSTEM.md structure validator ----
// Regex-based so heading-level changes don't silently break (^## captures
// lines that START with exactly that heading, multiline flag per match).
const DESIGN_SYSTEM_PATH = 'docs/DESIGN-SYSTEM.md';
const DESIGN_SYSTEM_HEADINGS = [
  /^## 1\. Philosophy$/m,
  /^## 2\. Tokens$/m,
  /^### 2\.1 Colors$/m,
  /^### 2\.2 Typography$/m,
  /^### 2\.3 Spacing$/m,
  /^### 2\.4 Motion$/m,
  /^## 3\. Usage examples$/m,
  /^## 4\. Iconography$/m,
  /^## 5\. Typography provenance$/m,
  /^## 6\. Hero art provenance$/m,
  /^## 7\. Exclusion checklist$/m,
  /^## 8\. Changelog$/m,
];
const DESIGN_SYSTEM_LITERALS = [
  // UI-05 Exclusion checklist literal sentinel (verified by antiBloat grep
  // test — this doc is outside the grep scope but the literal is the canonical
  // enforcement statement).
  'WiiWho does NOT display: ads, news feeds, concurrent-user counts, friends lists, marketing content',
  // D-13 → RESEARCH preset-tuning record (Crimson / Amber / Slate WCAG 2.1
  // SC 1.4.11 substitutions).
  'D-13 listed Red/Yellow/Gray as illustrative starting points',
];

// ---- Runner ----
let failures = 0;

for (const { file, required } of substringChecks) {
  const path = join(ROOT, file);
  if (!existsSync(path)) {
    console.error(`FAIL: ${file} does not exist`);
    failures++;
    continue;
  }
  const body = readFileSync(path, 'utf8');
  for (const needle of required) {
    if (!body.includes(needle)) {
      console.error(`FAIL: ${file} missing required substring ${JSON.stringify(needle)}`);
      failures++;
    }
  }
}

// DESIGN-SYSTEM.md — regex heading check + literal substring check.
{
  const path = join(ROOT, DESIGN_SYSTEM_PATH);
  if (!existsSync(path)) {
    console.error(`FAIL: ${DESIGN_SYSTEM_PATH} does not exist`);
    failures++;
  } else {
    const body = readFileSync(path, 'utf8');
    for (const rx of DESIGN_SYSTEM_HEADINGS) {
      if (!rx.test(body)) {
        console.error(`FAIL: ${DESIGN_SYSTEM_PATH} missing heading ${rx}`);
        failures++;
      }
    }
    for (const needle of DESIGN_SYSTEM_LITERALS) {
      if (!body.includes(needle)) {
        console.error(`FAIL: ${DESIGN_SYSTEM_PATH} missing required literal ${JSON.stringify(needle)}`);
        failures++;
      }
    }
  }
}

const totalAssertions =
  substringChecks.reduce((n, c) => n + c.required.length, 0) +
  DESIGN_SYSTEM_HEADINGS.length +
  DESIGN_SYSTEM_LITERALS.length +
  1; // +1 for DESIGN_SYSTEM_PATH existence

if (failures === 0) {
  console.log(
    `OK: ${substringChecks.length + 1} docs pass ${totalAssertions} content assertions`
  );
  process.exit(0);
} else {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
