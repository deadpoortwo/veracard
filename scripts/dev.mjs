import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["server/index.mjs"], { stdio: "inherit", windowsHide: true }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4173", "--strictPort", ...process.argv.slice(2)],
    { stdio: "inherit", windowsHide: true },
  ),
];

let closing = false;
const stop = (code) => {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill();
  process.exitCode = code;
};
for (const child of children) child.on("exit", (code) => stop(code || 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
