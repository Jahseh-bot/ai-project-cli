import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { generate, profiles } from "../src/templates.js";
import { planFiles, applyPlan, rollback } from "../src/transactions.js";
import { json, read, write, safePath, hash } from "../src/files.js";
import {
  importSkill,
  selectedAgents,
  skillFiles,
  installSkillFiles,
} from "../src/skills.js";
import { loadExtension } from "../src/extensions.js";
import { inspect } from "../src/inspect.js";
const cli = path.resolve("bin/ai-project.js");
function temp(t) {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "ai-project-test-")),
  );
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("transaction applies and restores original content", (t) => {
  const root = temp(t);
  write(root, "package.json", json({ scripts: { dev: "existing" } }));
  const before = read(root, "package.json");
  const plan = planFiles(
    root,
    {
      "package.json": json({ scripts: { lint: "eslint ." } }),
      "AGENTS.md": "rules",
    },
    { mergePackage: true },
  );
  const id = applyPlan(root, plan);
  assert.equal(JSON.parse(read(root, "package.json")).scripts.dev, "existing");
  rollback(root, id);
  assert.equal(read(root, "package.json"), before);
  assert.equal(read(root, "AGENTS.md"), null);
});
test("conflicting package keys stop all writes", (t) => {
  const root = temp(t);
  write(root, "package.json", json({ scripts: { lint: "custom" } }));
  const plan = planFiles(
    root,
    {
      "package.json": json({ scripts: { lint: "eslint ." } }),
      "new.txt": "new",
    },
    { mergePackage: true },
  );
  assert.throws(() => applyPlan(root, plan), /冲突/);
  assert.equal(read(root, "new.txt"), null);
});
test("stale plan stops before touching files", (t) => {
  const root = temp(t);
  const plan = planFiles(root, { "a.txt": "a", "b.txt": "b" });
  write(root, "b.txt", "user");
  assert.throws(() => applyPlan(root, plan), /已变化/);
  assert.equal(read(root, "a.txt"), null);
});
test("rollback refuses to erase later user edits", (t) => {
  const root = temp(t);
  const id = applyPlan(root, planFiles(root, { "a.txt": "generated" }));
  write(root, "a.txt", "user edit");
  assert.throws(() => rollback(root, id), /又被修改/);
  assert.equal(read(root, "a.txt"), "user edit");
});
test("path traversal and symlinks are rejected", (t) => {
  const root = temp(t);
  for (const file of [
    "../outside",
    "/absolute",
    "a/../b",
    "C:/bad",
    "a\\b",
    "a//b",
  ])
    assert.throws(() => safePath(root, file));
  fs.symlinkSync(os.tmpdir(), path.join(root, "escape"));
  assert.throws(() => write(root, "escape/bad", "bad"), /符号链接/);
});
test("tampered plan hashes and internal targets are rejected", (t) => {
  const root = temp(t);
  const plan = planFiles(root, { "a.txt": "a" });
  plan.changes[0].beforeHash = "fake";
  assert.throws(() => applyPlan(root, plan), /校验和/);
  const internal = planFiles(root, { ".ai-project/backups/evil": "bad" });
  assert.throws(() => applyPlan(root, internal), /内部/);
});
test("every allowed template combination emits quality and project metadata", () => {
  let total = 0;
  for (const profile of Object.keys(profiles))
    for (const ai of ["none", "chat", "rag", "agent"])
      for (const database of ["none", "postgres", "sqlite"])
        for (const architecture of ["layered", "workspace"]) {
          if (
            profile === "api-python" &&
            (ai !== "none" || database !== "none" || architecture !== "layered")
          )
            continue;
          const files = generate({
            name: "sample",
            profile,
            ai,
            database,
            architecture,
            agents: "codex",
          });
          const pkg = JSON.parse(files["package.json"]);
          for (const key of ["lint", "format:check", "test", "build", "check"])
            assert.ok(pkg.scripts[key], profile + key);
          assert.ok(files[".github/workflows/quality.yml"]);
          assert.ok(files["AGENTS.md"]);
          assert.ok(files[".ai-project/skills-lock.json"]);
          if (ai !== "none") {
            assert.ok(files["evals/dataset.json"]);
            assert.ok(files["tests/ai.test.js"]);
          }
          total++;
        }
  assert.equal(total, (Object.keys(profiles).length - 1) * 24 + 1);
});
test("invalid combinations are rejected", () => {
  assert.throws(() => generate({ name: "../bad" }));
  assert.throws(() =>
    generate({ name: "sample", profile: "api-python", ai: "rag" }),
  );
  assert.throws(() => selectedAgents("made-up-agent"));
});
test("custom skills retain source and content hash, never execute scripts", (t) => {
  const root = temp(t),
    source = temp(t);
  write(
    source,
    "SKILL.md",
    "---\nname: sample-skill\ndescription: A test skill\n---\nUse carefully.\n",
  );
  write(source, "scripts/run.sh", "echo DO_NOT_RUN\n");
  const skill = importSkill(source);
  assert.match(skill.revision, /^sha256:/);
  const agents = selectedAgents("codex,claude-code");
  const desired = installSkillFiles(root, skill, agents);
  applyPlan(root, planFiles(root, desired));
  const report = inspect(root);
  assert.ok(
    report.checks
      .filter((c) => c.id.startsWith("skill:"))
      .every((c) => c.status === "present"),
  );
  const file = Object.keys(skillFiles(skill, agents))[0];
  write(root, file, "modified");
  assert.ok(
    inspect(root).checks.some(
      (c) => c.id === "skill:" + file && c.status === "missing",
    ),
  );
});
test("skill symlinks cannot leak external files", (t) => {
  const source = temp(t);
  write(source, "SKILL.md", "---\nname: test\ndescription: test\n---\n");
  fs.symlinkSync("/etc/passwd", path.join(source, "leak.txt"));
  assert.throws(() => importSkill(source), /符号链接/);
});
test("extensions enforce compatibility and preserve internal metadata", (t) => {
  const root = temp(t);
  write(root, "extra.txt", "hello");
  const manifest = {
    schemaVersion: 1,
    name: "test",
    version: "1",
    compatibility: { profile: ["api-node"], ai: ["none"], database: ["none"] },
    checks: ["npm test"],
    files: { "docs/extra.md": "extra.txt" },
  };
  write(root, "extension.json", json(manifest));
  assert.equal(
    loadExtension(root, { profile: "api-node", ai: "none", database: "none" })
      .files["docs/extra.md"],
    "hello",
  );
  assert.throws(
    () =>
      loadExtension(root, {
        profile: "web-react",
        ai: "none",
        database: "none",
      }),
    /不兼容/,
  );
  manifest.files = { ".ai-project/project.json": "extra.txt" };
  write(root, "extension.json", json(manifest));
  assert.throws(
    () =>
      loadExtension(root, {
        profile: "api-node",
        ai: "none",
        database: "none",
      }),
    /元数据/,
  );
});
test("CLI end-to-end: create, refuse overwrite, inspect JSON", (t) => {
  const root = path.join(temp(t), "new-app");
  execFileSync(process.execPath, [
    cli,
    "init",
    root,
    "--profile",
    "api-node",
    "--agents",
    "codex",
    "--yes",
  ]);
  assert.ok(fs.existsSync(path.join(root, "src/http.js")));
  const overwritten = spawnSync(
    process.execPath,
    [cli, "init", root, "--yes"],
    { encoding: "utf8" },
  );
  assert.equal(overwritten.status, 1);
  const result = spawnSync(process.execPath, [cli, "inspect", root, "--json"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.ok(
    JSON.parse(result.stdout).checks.some(
      (c) => c.id === "lockfile" && c.status === "missing",
    ),
  );
});
test("CLI skill add makes preview then applies locked files", (t) => {
  const root = temp(t);
  execFileSync(process.execPath, [
    cli,
    "skills",
    "add",
    "quality-gates",
    "--project",
    root,
    "--agents",
    "codex",
  ]);
  assert.equal(read(root, ".agents/skills/quality-gates/SKILL.md"), null);
  execFileSync(process.execPath, [cli, "apply", root, "--yes"]);
  execFileSync(process.execPath, [
    cli,
    "skills",
    "add",
    "test-design",
    "--project",
    root,
    "--agents",
    "codex",
    "--yes",
  ]);
  const lock = JSON.parse(read(root, ".ai-project/skills-lock.json"));
  assert.equal(lock.skills.length, 2);
});
test("template skill hashes match actual generated content", () => {
  const files = generate({ name: "sample", agents: "all" });
  for (const skill of JSON.parse(files[".ai-project/skills-lock.json"]).skills)
    for (const [file, expected] of Object.entries(skill.files))
      assert.equal(hash(files[file]), expected);
});
test("retrofit preserves custom instructions and ignore patterns", (t) => {
  const root = temp(t);
  write(root, "AGENTS.md", "# Team rules\nKeep custom behavior.\n");
  write(root, ".gitignore", "custom-cache/\n");
  const desired = {
    "AGENTS.md": "# Baseline\nRun checks.\n",
    ".gitignore": "node_modules/\n",
  };
  const plan = planFiles(root, desired, { mergeGuidance: true });
  assert.equal(plan.conflicts.length, 0);
  applyPlan(root, plan);
  assert.match(read(root, "AGENTS.md"), /Keep custom behavior/);
  assert.match(read(root, ".gitignore"), /custom-cache/);
  assert.equal(
    planFiles(root, desired, { mergeGuidance: true }).changes.length,
    0,
  );
});

test("verify records failed project checks and returns nonzero", (t) => {
  const root = temp(t);
  write(
    root,
    "package.json",
    json({ scripts: { check: 'node -e "process.exit(1)"' } }),
  );
  const result = spawnSync(process.execPath, [cli, "verify", root], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.equal(
    JSON.parse(read(root, ".ai-project/verification.json")).status,
    "failed",
  );
});

test("extension migrations use the same preview and conflict protection", (t) => {
  const project = temp(t),
    extension = temp(t);
  write(project, "AGENTS.md", "User instructions\n");
  write(extension, "rules.md", "Team baseline\n");
  write(
    extension,
    "extension.json",
    json({
      schemaVersion: 1,
      name: "team",
      version: "1.0.0",
      compatibility: { profile: ["custom"], ai: ["none"], database: ["none"] },
      files: {},
      migrationFiles: { "AGENTS.md": "rules.md" },
      checks: ["manual review"],
    }),
  );
  execFileSync(process.execPath, [
    cli,
    "plan",
    project,
    "--profile",
    "custom",
    "--extension",
    extension,
  ]);
  assert.equal(read(project, "AGENTS.md"), "User instructions\n");
  execFileSync(process.execPath, [cli, "apply", project, "--yes"]);
  assert.match(read(project, "AGENTS.md"), /User instructions/);
  assert.match(read(project, "AGENTS.md"), /Team baseline/);
});
