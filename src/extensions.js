import { read, safePath } from "./files.js";
export function loadExtension(directory, options, mode = "generate") {
  const manifest = JSON.parse(read(directory, "extension.json") ?? "null");
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    !/^[a-z][a-z0-9-]*$/.test(manifest.name) ||
    !manifest.version ||
    !manifest.compatibility ||
    !manifest.files ||
    !Array.isArray(manifest.checks) ||
    manifest.checks.length === 0
  )
    throw new Error(
      "扩展需包含 schemaVersion=1、name、version、compatibility、files 和非空 checks",
    );
  for (const field of ["profile", "ai", "database"]) {
    if (
      !Array.isArray(manifest.compatibility[field]) ||
      !manifest.compatibility[field].includes(options[field])
    )
      throw new Error(`扩展不兼容 ${field}=${options[field]}`);
  }
  const mapping = mode === "migrate" ? manifest.migrationFiles : manifest.files;
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping))
    throw new Error("扩展缺少此模式的文件映射: " + mode);
  const files = {};
  for (const [target, source] of Object.entries(mapping)) {
    safePath(directory, target);
    if (target.startsWith(".ai-project/"))
      throw new Error("扩展不能替换生成器内部元数据");
    const content = read(directory, source);
    if (content === null) throw new Error("扩展文件不存在: " + source);
    files[target] = content;
  }
  for (const check of manifest.checks)
    if (typeof check !== "string" || !check.trim())
      throw new Error("扩展检查命令无效");
  return { manifest, files };
}
