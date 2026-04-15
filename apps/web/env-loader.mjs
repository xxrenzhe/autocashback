import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

export function getEnvCandidates(appDir, mode = process.env.NODE_ENV || "development") {
  const normalizedAppDir = path.resolve(appDir);
  const rootDir = path.resolve(normalizedAppDir, "../..");
  const envFiles = [
    `.env.${mode}.local`,
    ".env.local",
    `.env.${mode}`,
    ".env"
  ];

  return [
    ...envFiles.map((filename) => path.join(normalizedAppDir, filename)),
    ...envFiles.map((filename) => path.join(rootDir, filename))
  ];
}

export function loadWorkspaceAndRootEnv(appDir, mode = process.env.NODE_ENV || "development") {
  const loadedFiles = [];

  for (const fullPath of getEnvCandidates(appDir, mode)) {
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    dotenv.config({
      path: fullPath,
      override: false
    });
    loadedFiles.push(fullPath);
  }

  return loadedFiles;
}
