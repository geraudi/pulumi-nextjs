#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Enhanced symlink fixer for pnpm + OpenNext compatibility
 *
 * This script addresses the fundamental issue where OpenNext's dependency
 * installation process doesn't properly handle pnpm's symlink structure
 * when creating Lambda packages.
 */

class PnpmSymlinkFixer {
  private openNextDir: string;
  private fixed: number;
  private errors: number;

  constructor(openNextDir = ".open-next") {
    this.openNextDir = openNextDir;
    this.fixed = 0;
    this.errors = 0;
  }

  log(message: string, type = "info") {
    const prefix = {
      info: "ℹ️",
      success: "✅",
      error: "❌",
      warning: "⚠️",
    }[type];
    console.log(`${prefix} ${message}`);
  }

  /**
   * Find all .bin directories in the OpenNext output
   */
  findBinDirectories() {
    const binDirs: string[] = [];

    const searchDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === ".bin") {
            binDirs.push(fullPath);
          } else if (entry.name === "node_modules") {
            // Look for .bin in node_modules
            const binPath = path.join(fullPath, ".bin");
            if (fs.existsSync(binPath)) {
              binDirs.push(binPath);
            }
          } else {
            searchDir(fullPath);
          }
        }
      }
    };

    searchDir(this.openNextDir);
    return binDirs;
  }

  /**
   * Resolve pnpm symlinks by finding the actual executable files
   */
  resolvePnpmSymlink(symlinkPath: string, binDir: string) {
    try {
      const target = fs.readlinkSync(symlinkPath);
      const fileName = path.basename(symlinkPath);

      // For pnpm, we need to look in the store or find the actual package
      const nodeModulesDir = path.dirname(binDir);

      // Common patterns for finding the actual executable
      const searchPaths = [
        // Direct relative path resolution
        path.resolve(binDir, target),
        // Look in the package's bin directory
        path.join(nodeModulesDir, fileName, "bin.js"),
        path.join(nodeModulesDir, fileName, "cli.js"),
        path.join(nodeModulesDir, fileName, "index.js"),
        path.join(nodeModulesDir, fileName, `bin/${fileName}`),
        path.join(nodeModulesDir, fileName, `bin/${fileName}.js`),
        // Look for the package in common locations
        path.join(
          nodeModulesDir,
          `.pnpm/${fileName}@*/node_modules/${fileName}/bin.js`,
        ),
        path.join(
          nodeModulesDir,
          `.pnpm/${fileName}@*/node_modules/${fileName}/cli.js`,
        ),
      ];

      // Try to find the actual file
      for (const searchPath of searchPaths) {
        if (searchPath.includes("*")) {
          // Handle glob patterns for pnpm store
          const globPattern = searchPath;
          const baseDir = globPattern.split("*")[0];
          const suffix = globPattern.split("*")[1];

          if (fs.existsSync(path.dirname(baseDir))) {
            const entries = fs.readdirSync(path.dirname(baseDir));
            for (const entry of entries) {
              if (entry.startsWith(path.basename(baseDir).replace("@", ""))) {
                const fullPath = path.join(
                  path.dirname(baseDir),
                  entry,
                  suffix,
                );
                if (fs.existsSync(fullPath)) {
                  return fullPath;
                }
              }
            }
          }
        } else if (fs.existsSync(searchPath)) {
          return searchPath;
        }
      }

      return null;
    } catch (error) {
      this.log(
        `Error resolving symlink ${symlinkPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
      return null;
    }
  }

  /**
   * Fix a single symlink by replacing it with the actual file
   */
  fixSymlink(symlinkPath: string, binDir: string) {
    const fileName = path.basename(symlinkPath);

    try {
      // Check if symlink is broken
      fs.accessSync(symlinkPath);
      this.log(`Symlink ${fileName} is valid`, "success");
      return true;
    } catch (error) {
      this.log(
        `Fixing broken symlink: ${fileName}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "warning",
      );

      const actualFile = this.resolvePnpmSymlink(symlinkPath, binDir);

      if (actualFile && fs.existsSync(actualFile)) {
        // Remove broken symlink
        fs.unlinkSync(symlinkPath);

        // Copy the actual file
        fs.copyFileSync(actualFile, symlinkPath);

        // Make it executable
        fs.chmodSync(symlinkPath, 0o755);

        this.log(
          `Fixed ${fileName} -> ${path.relative(process.cwd(), actualFile)}`,
          "success",
        );
        this.fixed++;
        return true;
      } else {
        this.log(`Could not find actual file for ${fileName}`, "error");
        // Remove the broken symlink
        fs.unlinkSync(symlinkPath);
        this.errors++;
        return false;
      }
    }
  }

  /**
   * Process all symlinks in a .bin directory
   */
  processBinDirectory(binDir: string) {
    this.log(`Processing ${binDir}`);

    if (!fs.existsSync(binDir)) {
      this.log(`Directory ${binDir} does not exist`, "warning");
      return;
    }

    const files = fs.readdirSync(binDir);

    for (const file of files) {
      const filePath = path.join(binDir, file);

      try {
        const stats = fs.lstatSync(filePath);

        if (stats.isSymbolicLink()) {
          this.fixSymlink(filePath, binDir);
        }
      } catch (error) {
        this.log(
          `Error processing ${file}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
        this.errors++;
      }
    }
  }

  /**
   * Main method to fix all symlinks in OpenNext output
   */
  fixAll() {
    this.log("Starting pnpm symlink fix for OpenNext...");

    if (!fs.existsSync(this.openNextDir)) {
      this.log(`OpenNext directory ${this.openNextDir} not found`, "error");
      return false;
    }

    const binDirectories = this.findBinDirectories();

    if (binDirectories.length === 0) {
      this.log("No .bin directories found", "warning");
      return true;
    }

    this.log(`Found ${binDirectories.length} .bin directories`);

    for (const binDir of binDirectories) {
      this.processBinDirectory(binDir);
    }

    this.log(
      `Symlink fix complete! Fixed: ${this.fixed}, Errors: ${this.errors}`,
      this.errors === 0 ? "success" : "warning",
    );

    return this.errors === 0;
  }
}

export const fixSymLinks = (openNextDir: string) => {
  const fixer = new PnpmSymlinkFixer(openNextDir);
  fixer.fixAll();
};
