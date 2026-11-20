import fs from "node:fs";
import { read, hash } from "./files.js";

export function inspect(root) {
  if (!fs.existsSync(root)) throw new Error("项目目录不存在");
  const pkg = JSON.parse(read(root, "package.json") ?? "{}");
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const stacks = [];
  for (const name of [
    "react",
    "vue",
    "next",
    "nuxt",
    "expo",
    "react-native",
    "electron",
    "fastify",
    "express",
  ])
    if (deps[name]) stacks.push(name);
  for (const [file, name] of [
    ["pyproject.toml", "python"],
    ["go.mod", "go"],
    ["Cargo.toml", "rust"],
    ["pubspec.yaml", "flutter/dart"],
    ["pom.xml", "java"],
  ])
    if (read(root, file) !== null) stacks.push(name);
  const checks = [];
  const add = (id, ok, detail) =>
    checks.push({ id, status: ok ? "present" : "missing", detail });
  add("instructions", read(root, "AGENTS.md") !== null, "项目开发规则");
  add(
    "lint",
    Boolean(pkg.scripts?.lint),
    "package.json scripts.lint；只检查存在性，不代表已执行",
  );
  add("format", Boolean(pkg.scripts?.["format:check"]), "格式检查命令");
  add("tests", Boolean(pkg.scripts?.test), "测试命令");
  add("build", Boolean(pkg.scripts?.build), "构建命令");
  add(
    "ci",
    read(root, ".github/workflows/quality.yml") !== null,
    "生成器约定的 CI 文件；其他 CI 需人工检查",
  );
  add(
    "lockfile",
    [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "uv.lock",
      "Cargo.lock",
      "pubspec.lock",
    ].some((f) => read(root, f) !== null),
    "可复现依赖锁",
  );
  const lock = JSON.parse(
    read(root, ".ai-project/skills-lock.json") ?? '{"skills":[]}',
  );
  for (const skill of lock.skills)
    for (const [file, expected] of Object.entries(skill.files)) {
      const content = read(root, file);
      add(
        `skill:${file}`,
        content !== null && hash(content) === expected,
        "技能内容与固定快照是否一致",
      );
    }
  return {
    root,
    stacks,
    checks,
    summary: "静态检查；不会执行项目脚本，也不代表构建或测试通过。",
  };
}
