import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

const rootDir = process.cwd();
const mode = process.env.NODE_ENV || "development";
const envFiles = [
  `.env.${mode}.local`,
  ".env.local",
  `.env.${mode}`,
  ".env"
];

for (const filename of envFiles) {
  const fullPath = path.join(rootDir, filename);

  if (!fs.existsSync(fullPath)) {
    continue;
  }

  dotenv.config({
    path: fullPath,
    override: false
  });
}
