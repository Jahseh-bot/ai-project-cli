import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { hash, json, read, write, safePath } from "./files.js";

export function planFiles(
  root,
  desired,
  { mergePackage = false, mergeGuidance = false } = {},
) {
  const changes = [],
    conflicts = [];
  for (const [file, proposed] of Object.entries(desired)) {
    const before = read(root, file);
    let after = proposed;
    if (before !== null && before !== after) {
      if (mergeGuidance && [".gitignore", ".prettierignore"].includes(file)) {
        const existing = new Set(before.split("\n"));
        const additions = after
          .split("\n")
          .filter((line) => line && !existing.has(line));
        after = additions.length
          ? before.replace(/\n?$/, "\n") + additions.join("\n") + "\n"
          : before;
      } else if (mergeGuidance && file === "AGENTS.md") {
        const start = "<!-- AI-PROJECT:START -->";
        const end = "<!-- AI-PROJECT:END -->";
        const block = start + "\n" + after + end;
        if (!before.includes(start))
          after = before.replace(/\n?$/, "\n") + "\n" + block + "\n";
        else if (before.includes(block)) after = before;
        else {
          conflicts.push({
            file,
            reason: "已有生成器规则块与目标不同，需要人工合并",
          });
          continue;
        }
      } else if (file === "package.json" && mergePackage) {
        const current = JSON.parse(before),
          incoming = JSON.parse(after);
        for (const group of ["scripts", "devDependencies"]) {
          current[group] ??= {};
          for (const [key, value] of Object.entries(incoming[group] ?? {})) {
            if (
              current[group][key] !== undefined &&
              current[group][key] !== value
            )
              conflicts.push({
                file,
                key: `${group}.${key}`,
                reason: "保留已有值；请手动合并",
              });
            else current[group][key] = value;
          }
        }
        after = json(current);
      } else {
        conflicts.push({
          file,
          reason: "已有自定义内容，保留原文件；请手动合并",
        });
        continue;
      }
    }
    if (before !== after)
      changes.push({
        file,
        before,
        after,
        beforeHash: before === null ? null : hash(before),
      });
  }
  return {
    schemaVersion: 1,
    root: path.resolve(root),
    createdAt: new Date().toISOString(),
    changes,
    conflicts,
  };
}
function validatePlan(plan, root) {
  if (
    plan.schemaVersion !== 1 ||
    plan.root !== path.resolve(root) ||
    !Array.isArray(plan.changes) ||
    !Array.isArray(plan.conflicts)
  )
    throw new Error("无效计划或项目路径不匹配");
  const seen = new Set();
  for (const change of plan.changes) {
    safePath(root, change.file);
    if (
      change.file.startsWith(".ai-project/backups/") ||
      change.file === ".ai-project/transaction.lock" ||
      change.file === ".ai-project/plan.json"
    )
      throw new Error("计划不能修改内部事务文件");
    if (seen.has(change.file)) throw new Error("计划包含重复路径");
    seen.add(change.file);
    if (
      typeof change.after !== "string" ||
      !(change.before === null || typeof change.before === "string") ||
      change.beforeHash !==
        (change.before === null ? null : hash(change.before))
    )
      throw new Error("计划内容或校验和无效");
    if (read(root, change.file) !== change.before)
      throw new Error(`预览后文件已变化，请重新生成计划: ${change.file}`);
  }
}
function lock(root, action) {
  const file = safePath(root, ".ai-project/transaction.lock");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, "wx");
  try {
    return action();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(file);
  }
}
export function applyPlan(root, plan) {
  return lock(root, () => {
    validatePlan(plan, root);
    if (plan.conflicts.length)
      throw new Error(
        "存在未解决冲突；未应用任何改动。请手动合并后重新生成计划。",
      );
    if (!plan.changes.length) return null;
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const backup = { ...plan, id, state: "pending", applied: [] };
    const journal = `.ai-project/backups/${id}.json`;
    write(root, journal, json(backup));
    try {
      for (const change of plan.changes) {
        if (read(root, change.file) !== change.before)
          throw new Error(`应用期间文件已变化: ${change.file}`);
        // Journal intent before the write: rollback recognizes both old and new content.
        backup.applied.push(change.file);
        write(root, journal, json(backup));
        write(root, change.file, change.after);
      }
      backup.state = "applied";
      write(root, journal, json(backup));
      return id;
    } catch (error) {
      throw new Error(
        `应用中断，使用 rollback ${id} 恢复。原因: ${error.message}`,
      );
    }
  });
}
export function rollback(root, id) {
  if (!/^[0-9]+-[a-f0-9]{8}$/.test(id)) throw new Error("无效备份 ID");
  return lock(root, () => {
    const journal = `.ai-project/backups/${id}.json`;
    const backup = JSON.parse(read(root, journal) ?? "null");
    if (!backup || backup.root !== path.resolve(root))
      throw new Error("备份不存在或路径不匹配");
    if (backup.state === "rolled-back") throw new Error("此备份已经恢复");
    const changes = backup.changes.filter((c) =>
      backup.applied.includes(c.file),
    );
    for (const change of changes) {
      const actual = read(root, change.file);
      if (actual !== change.after && actual !== change.before)
        throw new Error(`文件在改造后又被修改，拒绝覆盖: ${change.file}`);
    }
    for (const change of changes.reverse()) {
      if (change.before === null) {
        const file = safePath(root, change.file);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } else write(root, change.file, change.before);
    }
    backup.state = "rolled-back";
    write(root, journal, json(backup));
  });
}
export function formatPlan(plan) {
  return [
    ...plan.changes.flatMap((c) => [
      `\n--- ${c.file} (${c.before === null ? "新增" : "修改"})`,
      ...(c.before ?? "")
        .split("\n")
        .filter(Boolean)
        .map((l) => "- " + l),
      ...c.after
        .split("\n")
        .filter(Boolean)
        .map((l) => "+ " + l),
    ]),
    ...plan.conflicts.map(
      (c) => `\n冲突: ${c.file}${c.key ? ":" + c.key : ""} — ${c.reason}`,
    ),
    `\n${plan.changes.length} 个待修改文件，${plan.conflicts.length} 个冲突。`,
  ].join("\n");
}
