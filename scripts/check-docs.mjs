#!/usr/bin/env node
// scripts/check-docs.mjs — asserts Phase 1 policy docs are present with required content.
// Run from repo root: `node scripts/check-docs.mjs`
// Exit 0 = all pass, 1 = any failure (one line per failure printed to stderr).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const checks = [
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

let failures = 0;
for (const { file, required } of checks) {
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

if (failures === 0) {
  console.log(`OK: all ${checks.length} docs pass ${checks.reduce((n, c) => n + c.required.length, 0)} content assertions`);
  process.exit(0);
} else {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
