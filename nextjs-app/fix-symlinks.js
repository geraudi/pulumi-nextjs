#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function fixSymlinks() {
  const binDir = ".open-next/image-optimization-function/node_modules/.bin";

  if (!fs.existsSync(binDir)) {
    console.log("No .bin directory found, skipping symlink fix");
    return;
  }

  const files = fs.readdirSync(binDir);

  for (const file of files) {
    const symlinkPath = path.join(binDir, file);

    try {
      const stats = fs.lstatSync(symlinkPath);

      if (stats.isSymbolicLink()) {
        const target = fs.readlinkSync(symlinkPath);

        // Check if symlink is broken
        try {
          fs.accessSync(symlinkPath);
          console.log(`✓ Symlink ${file} is valid`);
        } catch (err) {
          console.log(`✗ Fixing broken symlink: ${file}`);

          // Find the actual binary in node_modules
          const targetBasename = path.basename(target);
          const nodeModulesDir = path.join(binDir, "..");

          // Look for the actual file
          let actualFile = null;

          if (file === "prebuild-install") {
            actualFile = path.join(nodeModulesDir, "prebuild-install/bin.js");
          } else if (file === "semver") {
            actualFile = path.join(nodeModulesDir, "semver/bin/semver.js");
          } else if (file === "rc") {
            actualFile = path.join(nodeModulesDir, "rc/cli.js");
          }

          if (actualFile && fs.existsSync(actualFile)) {
            // Remove broken symlink
            fs.unlinkSync(symlinkPath);

            // Create new relative symlink
            const relativePath = path.relative(binDir, actualFile);
            fs.symlinkSync(relativePath, symlinkPath);

            console.log(`✓ Fixed ${file} -> ${relativePath}`);
          } else {
            console.log(`✗ Could not find target for ${file}`);
          }
        }
      }
    } catch (err) {
      console.log(`Error processing ${file}:`, err.message);
    }
  }
}

console.log("Fixing OpenNext symlinks...");
fixSymlinks();
console.log("Symlink fix complete!");
