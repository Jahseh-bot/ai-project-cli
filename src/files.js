import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export function safePath(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    relative.includes("\\") ||
    relative.includes("\0") ||
    relative.includes(":") ||
    relative.split("/").some((p) => !p || p === "." || p === "..") ||
    path.isAbsolute(relative)
  )
    throw new Error(`不安全的相对路径: ${relative}`);
  const base = path.resolve(root);
  // Reject symlinks in the root ancestry as well as every target component.
  let current = path.parse(base).root;
  for (const part of path
    .relative(current, base)
    .split(path.sep)
    .filter(Boolean)
    .concat(relative.split("/"))) {
    current = path.join(current, part);
    if (
      fs.existsSync(current) ||
      (() => {
        try {
          fs.lstatSync(current);
          return true;
        } catch {
          return false;
        }
      })()
    ) {
      if (fs.lstatSync(current).isSymbolicLink())
        throw new Error(`拒绝通过符号链接写入: ${current}`);
    }
  }
  return path.join(base, relative);
}
export function read(root, file) {
  const full = safePath(root, file);
  if (!fs.existsSync(full)) return null;
  if (!fs.statSync(full).isFile()) throw new Error(`目标不是文件: ${file}`);
  return fs.readFileSync(full, "utf8");
}
export function write(root, file, content) {
  const full = safePath(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const temporary = full + `.tmp-${crypto.randomUUID()}`;
  fs.writeFileSync(temporary, content, { mode: 0o600, flag: "wx" });
  fs.renameSync(temporary, full);
}
export function snapshot(root) {
  const files = {};
  let bytes = 0;
  function walk(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if ([".git", "node_modules", ".venv", ".DS_Store"].includes(entry.name))
        continue;
      const name = prefix + entry.name;
      const full = safePath(root, name);
      if (entry.isDirectory()) walk(full, name + "/");
      else if (entry.isFile()) {
        bytes += fs.statSync(full).size;
        if (bytes > 10 * 1024 * 1024)
          throw new Error("技能/扩展包超过 10 MiB 限制");
        files[name] = fs.readFileSync(full).toString("base64");
      } else throw new Error(`不支持的文件类型: ${name}`);
    }
  }
  walk(root);
  return Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
  );
}
