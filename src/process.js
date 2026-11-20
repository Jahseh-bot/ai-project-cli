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
