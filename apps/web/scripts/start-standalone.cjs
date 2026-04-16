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
