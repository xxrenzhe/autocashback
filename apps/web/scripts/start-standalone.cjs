const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const candidates = [
  path.resolve(__dirname, "..", ".next", "standalone", "server.js"),
  path.resolve(__dirname, "..", ".next", "standalone", "apps", "web", "server.js")
];

const serverPath = candidates.find((candidate) => fs.existsSync(candidate));

if (!serverPath) {
  process.stderr.write(
    `Standalone server entry not found. Checked:\n${candidates.map((candidate) => `- ${candidate}`).join("\n")}\n`
  );
  process.exit(1);
}

function ensureStandaloneAssetPath(targetPath, sourcePath) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  try {
    fs.symlinkSync(sourcePath, targetPath, "junction");
  } catch (error) {
    if (error && error.code === "EPERM") {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
      return;
    }

    throw error;
  }
}

const appRoot = path.resolve(__dirname, "..");
const standaloneAppRoot = path.dirname(serverPath);

ensureStandaloneAssetPath(
  path.join(standaloneAppRoot, ".next", "static"),
  path.join(appRoot, ".next", "static")
);
ensureStandaloneAssetPath(path.join(standaloneAppRoot, "public"), path.join(appRoot, "public"));

const child = spawn(process.execPath, [serverPath], {
  cwd: path.dirname(serverPath),
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
