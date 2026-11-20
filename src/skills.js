import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { snapshot, hash, json, read, safePath } from "./files.js";

export const agentCatalog = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../catalog/agents.json", import.meta.url)),
    "utf8",
  ),
);
export const curatedSkills = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../catalog/skills.json", import.meta.url)),
    "utf8",
  ),
);
export function recommendSkills({ profile = "", database = "none" } = {}) {
  const tags = new Set();
  if (profile.includes("react") || profile === "desktop-electron")
    tags.add("react");
  if (
    profile.startsWith("web-") ||
    profile.startsWith("fullstack-") ||
    profile === "desktop-electron"
  )
    tags.add("web");
  if (profile === "mobile-expo") tags.add("mobile");
  if (database === "postgres") tags.add("postgres");
  return curatedSkills.filter((skill) =>
    skill.tags.some((tag) => tags.has(tag)),
  );
}
export function resolveSkill(nameOrSource, options = {}) {
  if (builtins[nameOrSource]) return builtinSkill(nameOrSource);
  const entry = curatedSkills.find((skill) => skill.name === nameOrSource);
  return entry
    ? importSkill(entry.source, { ref: entry.revision, subdir: entry.subdir })
    : importSkill(nameOrSource, options);
}
export const builtins = {
  "quality-gates": [
    "Run the project quality gates when changing code.",
    "Read package scripts and CI first. Run formatting, lint, type checks, relevant tests and builds. Report exact commands, failures and checks not run. Never disable a check merely to make it pass.",
  ],
  "architecture-review": [
    "Review module boundaries before changing architecture.",
    "Read docs/architecture.md and decisions. Keep domain behavior separate from transport and external providers. Explain dependencies and migration impacts. Prefer existing patterns.",
  ],
  "test-design": [
    "Choose meaningful regression tests for behavior changes.",
    "Identify the failure a change prevents. Cover observable behavior, boundary cases and integration contracts. Avoid tests that only mirror implementation. For AI features distinguish deterministic unit tests from outcome evaluations.",
  ],
  "ai-evaluation": [
    "Evaluate changes to AI behavior and tool execution.",
    "Read evals and model configuration. Test timeouts, malformed output, denied tools and cost limits. Use task-specific datasets and clear success criteria. Label fixture tests separately from live-model evaluations. Never claim mock results measure model quality.",
  ],
  "frontend-accessibility": [
    "Check accessibility when modifying user interfaces.",
    "Use semantic controls and labels. Verify keyboard navigation, focus visibility, loading and error states. Check responsive layout and contrast. Use the project frontend testing tools.",
  ],
};
export function selectedAgents(ids) {
  const list =
    ids === "all"
      ? agentCatalog.agents.map((a) => a.id)
      : String(ids ?? "codex,claude-code,cursor")
          .split(",")
          .filter(Boolean);
  if (!list.length) throw new Error("至少选择一个编程助手");
  return [...new Set(list)].map((id) => {
    const agent = agentCatalog.agents.find((a) => a.id === id);
    if (!agent) throw new Error(`未知助手 ${id}；运行 agents 查看清单`);
    return agent;
  });
}
export function skillFiles(skill, agents) {
  const output = {};
  // Use copies, not symlinks: Windows portable and transaction-safe.
  for (const agent of agents)
    for (const [file, content] of Object.entries(skill.files))
      output[`${agent.skillsDir}/${skill.name}/${file}`] = content;
  return output;
}
export function builtinSkill(name) {
  const value = builtins[name];
  if (!value) throw new Error(`未知内置 Skill: ${name}`);
  return {
    name,
    source: "builtin",
    revision: "0.1.0",
    files: {
      "SKILL.md": `---\nname: ${name}\ndescription: ${value[0]}\n---\n\n${value[1]}\n`,
    },
  };
}
export function importSkill(source, { ref, subdir = "." } = {}) {
  let temp, root, revision, origin;
  try {
    if (/^https:\/\//.test(source)) {
      const url = new URL(source);
      if (url.username || url.password) throw new Error("Git URL 不能包含凭据");
      if (
        subdir !== "." &&
        (path.isAbsolute(subdir) || subdir.split(/[\\/]/).includes(".."))
      )
        throw new Error("不安全的子目录");
      temp = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "ai-project-skill-")),
      );
      execFileSync(
        "git",
        [
          "-c",
          "core.hooksPath=/dev/null",
          "clone",
          "--no-checkout",
          "--",
          source,
          temp,
        ],
        {
          stdio: "pipe",
          timeout: 120000,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0",
            GIT_LFS_SKIP_SMUDGE: "1",
          },
        },
      );
      revision = execFileSync(
        "git",
        [
          "-C",
          temp,
          "rev-parse",
          "--verify",
          "--end-of-options",
          `${ref ?? "HEAD"}^{commit}`,
        ],
        { encoding: "utf8" },
      ).trim();
      execFileSync(
        "git",
        [
          "-c",
          "core.hooksPath=/dev/null",
          "-C",
          temp,
          "checkout",
          "--detach",
          revision,
        ],
        {
          stdio: "pipe",
          timeout: 30000,
          env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1" },
        },
      );
      root = subdir === "." ? temp : safePath(temp, subdir);
      origin = source;
    } else {
      root = path.resolve(source);
      origin = `local:${root}`;
    }
    const doc = read(root, "SKILL.md");
    if (!doc || !doc.startsWith("---\n"))
      throw new Error(
        "来源必须是包含 YAML frontmatter 的 SKILL.md 目录；仓库内技能可用 --subdir 指定",
      );
    const frontmatter = doc.split("---")[1];
    const name = /^name:\s*["']?([a-z0-9]+(?:-[a-z0-9]+)*)["']?\s*$/m.exec(
      frontmatter,
    )?.[1];
    if (!name || !/^description:\s*\S/m.test(frontmatter))
      throw new Error("SKILL.md 需要有效的 name 与 description");
    const encoded = snapshot(root),
      files = {};
    for (const [file, value] of Object.entries(encoded)) {
      const buffer = Buffer.from(value, "base64"),
        content = buffer.toString("utf8");
      if (!Buffer.from(content).equals(buffer) || content.includes("\0"))
        throw new Error(`首版自定义技能仅支持 UTF-8 文本资源: ${file}`);
      files[file] = content;
    }
    const integrity = hash(json(encoded));
    return {
      name,
      source: origin,
      revision: revision ?? `sha256:${integrity}`,
      integrity,
      files,
    };
  } finally {
    if (temp) fs.rmSync(temp, { recursive: true, force: true });
  }
}
export function installSkillFiles(root, skill, agents) {
  const lock = JSON.parse(
    read(root, ".ai-project/skills-lock.json") ??
      '{"schemaVersion":1,"skills":[]}',
  );
  const files = skillFiles(skill, agents);
  const record = {
    name: skill.name,
    source: skill.source,
    revision: skill.revision,
    integrity: skill.integrity ?? hash(json(skill.files)),
    agents: agents.map((a) => a.id),
    files: Object.fromEntries(
      Object.entries(files).map(([file, content]) => [file, hash(content)]),
    ),
  };
  const previous = lock.skills.find((s) => s.name === skill.name);
  if (previous && JSON.stringify(previous) !== JSON.stringify(record))
    throw new Error(
      "同名 Skill 已锁定。首版不自动覆盖或升级；请使用新名称或先手动审查现有技能。",
    );
  if (!previous) lock.skills.push(record);
  return { ...files, ".ai-project/skills-lock.json": json(lock) };
}
