import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(".artifacts/smoke");
fs.mkdirSync(root, { recursive: true });
const combinations = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "web-react",
      "web-vue",
      "api-node",
      "fullstack-react",
      "fullstack-vue",
      "desktop-electron",
      "mobile-expo",
    ];
let failed = false;
for (const profile of combinations) {
  const target = path.join(root, profile);
  if (fs.existsSync(target))
    fs.rmSync(target, { recursive: true, force: true });
  const commands = [
    [
      process.execPath,
      [
        path.resolve("bin/ai-project.js"),
        "init",
        target,
        "--profile",
        profile,
        "--ai",
        profile === "api-node" ? "agent" : "none",
        "--agents",
        "codex",
        "--yes",
      ],
    ],
    ["npm", ["install"]],
    ["npm", ["run", "format"]],
    ["npm", ["run", "check"]],
  ];
  const log = [];
  let success = true;
  for (let index = 0; index < commands.length; index++) {
    const [cmd, args] = commands[index];
    const result = spawnSync(cmd, args, {
      cwd: index === 0 ? process.cwd() : target,
      encoding: "utf8",
      timeout: 240000,
      maxBuffer: 10 * 1024 * 1024,
    });
    log.push(
      "$ " + cmd + " " + args.join(" "),
      result.stdout ?? "",
      result.stderr ?? "",
      result.error?.message ?? "",
    );
    if (result.status !== 0) {
      success = false;
      break;
    }
  }
  fs.writeFileSync(path.join(root, profile + ".log"), log.join("\n"));
  console.log(
    profile +
      ": " +
      (success
        ? "PASS (install, lint, format, tests, build)"
        : "FAIL — see .artifacts/smoke/" + profile + ".log"),
  );
  if (!success) failed = true;
}
process.exitCode = failed ? 1 : 0;
