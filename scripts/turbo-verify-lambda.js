#!/usr/bin/env node

/**
 * Turbo-optimized Lambda Package Verification
 *
 * Simple, fast verification that works well with Turbo's caching system.
 * Designed to be run as a Turbo task with proper inputs/outputs.
 */

const fs = require("node:fs");
const path = require("node:path");

function log(message, type = "info") {
  const prefix = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
  }[type];
  console.log(`${prefix} ${message}`);
}

function verifyLambdaPackages() {
  // Auto-detect OpenNext directory
  const openNextDir = fs.existsSync(".open-next")
    ? ".open-next"
    : "apps/web/.open-next";

  log("🔍 Verifying Lambda packages...");

  // Check if OpenNext output exists
  if (!fs.existsSync(openNextDir)) {
    log(`OpenNext directory ${openNextDir} not found`, "error");
    process.exit(1);
  }

  const outputFile = path.join(openNextDir, "open-next.output.json");
  if (!fs.existsSync(outputFile)) {
    log("open-next.output.json not found", "error");
    process.exit(1);
  }

  // Check required Lambda functions
  const requiredFunctions = [
    "server-functions/default",
    "image-optimization-function",
  ];

  let allFunctionsExist = true;
  for (const func of requiredFunctions) {
    const funcPath = path.join(openNextDir, func);
    const indexFile = path.join(funcPath, "index.mjs");

    if (!fs.existsSync(funcPath)) {
      log(`Missing function: ${func}`, "error");
      allFunctionsExist = false;
    } else if (!fs.existsSync(indexFile)) {
      log(`Missing index.mjs in ${func}`, "error");
      allFunctionsExist = false;
    } else {
      log(`✓ ${func}`, "success");
    }
  }

  // Quick symlink check
  let brokenSymlinks = 0;
  function checkSymlinks(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          fs.accessSync(fullPath);
        } catch {
          brokenSymlinks++;
          log(
            `Broken symlink: ${path.relative(openNextDir, fullPath)}`,
            "error",
          );
        }
      } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
        checkSymlinks(fullPath);
      }
    }
  }

  checkSymlinks(openNextDir);

  // Final result
  if (allFunctionsExist && brokenSymlinks === 0) {
    log("All Lambda packages verified successfully! 🎉", "success");
    process.exit(0);
  } else {
    log("Lambda package verification failed", "error");
    if (brokenSymlinks > 0) {
      log(`Run: cd ${path.dirname(openNextDir)} && pnpm fix-symlinks`, "info");
    }
    process.exit(1);
  }
}

// Run verification
verifyLambdaPackages();
