#!/usr/bin/env node
/**
 * Patch @payloadcms/next RootLayout to add suppressHydrationWarning to <body>.
 *
 * Why: Payload's RootLayout renders <body> without suppressHydrationWarning.
 * Browser extensions like Grammarly inject cz-shortcut-listen="true" on <body>
 * after SSR, causing a React hydration mismatch warning in the admin panel.
 * Payload does not expose a bodyProps API in this version, so we patch the
 * compiled output directly. This script re-applies the patch after every install.
 */
const fs = require('fs')
const path = require('path')

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  '@payloadcms',
  'next',
  'dist',
  'layouts',
  'Root',
  'index.js',
)

if (!fs.existsSync(targetFile)) {
  console.log('[patch-payload-body] Target file not found, skipping.')
  process.exit(0)
}

let content = fs.readFileSync(targetFile, 'utf8')

const MARKER = 'suppressHydrationWarning: true, // patched'
if (content.includes(MARKER)) {
  console.log('[patch-payload-body] Already patched, skipping.')
  process.exit(0)
}

// Match the body element opening — insert suppressHydrationWarning right after
const NEEDLE = '/*#__PURE__*/_jsxs("body", {'
const REPLACEMENT = `/*#__PURE__*/_jsxs("body", {\n      ${MARKER},`

if (!content.includes(NEEDLE)) {
  console.warn('[patch-payload-body] Pattern not found in target file — Payload may have been updated. Skipping patch.')
  process.exit(0)
}

content = content.replace(NEEDLE, REPLACEMENT)
fs.writeFileSync(targetFile, content, 'utf8')
console.log('[patch-payload-body] ✓ Patched <body suppressHydrationWarning> in @payloadcms/next RootLayout')
