import { execFileSync } from "node:child_process";
export function npmRun(args, options = {}) {
  if (!args.every((arg) => /^[a-zA-Z0-9:_-]+$/.test(arg)))
    throw new Error("Invalid npm command argument");
  const settings = { stdio: "inherit", timeout: 300000, ...options };
  if (process.platform === "win32")
    return execFileSync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", "npm " + args.join(" ")],
      settings,
    );
  return execFileSync("npm", args, settings);
}

export async function commandTask(command, args, { cwd, title }) {
  const { spawn } = await import("node:child_process");
  const { taskLog } = await import("@clack/prompts");
  if (!process.stdout.isTTY) {
    if (command === "npm") return npmRun(args, { cwd });
    return execFileSync(command, args, {
      cwd,
      stdio: "inherit",
      timeout: 300000,
    });
  }
  const log = taskLog({ title, limit: 4 });
  const isWindowsNpm = command === "npm" && process.platform === "win32";
  const executable = isWindowsNpm
    ? (process.env.ComSpec ?? "cmd.exe")
    : command;
  const parameters = isWindowsNpm
    ? ["/d", "/s", "/c", "npm " + args.join(" ")]
    : args;
  await new Promise((resolve, reject) => {
    const child = spawn(executable, parameters, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300000,
    });
    const capture = (chunk) => {
      for (const line of chunk.toString().split("\n").filter(Boolean))
        log.message(line);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", (error) => {
      log.error("无法启动：" + error.message);
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        log.success(title + " · 完成");
        resolve();
      } else {
        log.error(title + " · 失败，文件已保留");
        reject(new Error("命令执行失败，请查看上方输出"));
      }
    });
  });
}
