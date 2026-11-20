import { npmRun } from "./process.js";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { generate, profiles, retrofitFiles } from "./templates.js";
import { json, read, write, safePath, hash } from "./files.js";
import { planFiles, formatPlan, applyPlan, rollback } from "./transactions.js";
import {
  agentCatalog,
  builtins,
  selectedAgents,
  curatedSkills,
  recommendSkills,
  resolveSkill,
  installSkillFiles,
} from "./skills.js";
import { inspect } from "./inspect.js";
import { loadExtension } from "./extensions.js";

const help = `AI Project CLI 0.1.0\n\n用法：ai-project <command> [path] [options]\n\n  init <directory>       新建项目（空目录）\n  inspect [directory]    只读检查现有项目\n  verify [directory]     运行项目 check，保存验证结果\n  plan [directory]       预览并保存基础质量改造计划\n  apply [directory]      再次预览并确认应用计划\n  rollback <id>          恢复本次改动（--project 指定目录）\n  skills list            查看内置开发 Skills\n  skills add <source>    导入内置名、本地目录或 HTTPS Git 来源\n  agents                 查看固定版本的助手适配目录\n  templates              查看技术组合选项\n\n选项：\n  --profile <name>       模板（默认 fullstack-react）\n  --ai none|chat|rag|agent\n  --database none|postgres\n  --agents <a,b>|all     项目级 Skills 目标，默认 codex,claude-code,cursor\n  --skills <a,b>|none    新项目技能，默认按技术栈推荐\n  --extension <dir>     叠加本地声明式扩展包\n  --name <name>         项目包名\n  --project <dir>       Skills/恢复操作的项目位置\n  --ref <git-ref>        Git 技能来源版本；解析后锁定 commit\n  --subdir <dir>         Git 仓库内的技能目录\n  --install             新项目生成后安装依赖并初始化锁文件\n  --yes                 非交互；apply 时明确授权应用已展示计划\n  --json                inspect/agents/templates 的 JSON 输出\n  --help / --version\n\nCLI 不调用大模型，不修改全局 Skills，不自动运行导入技能的脚本。\n`;
async function ask(label, fallback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const value = (
      await rl.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)
    ).trim();
    return value || fallback;
  } finally {
    rl.close();
  }
}
async function confirmed(yes) {
  if (yes) return true;
  if (!process.stdin.isTTY)
    throw new Error("非交互应用需要 --yes；请先审查 plan 输出");
  return (await ask("确认应用上述改动？输入 yes", "no")) === "yes";
}
async function wizard(options, destination) {
  if (!process.stdin.isTTY || options.yes) return { options, destination };
  destination ??= await ask("项目目录", "my-ai-app");
  if (!options.profile) {
    console.log(
      Object.entries(profiles)
        .map(([id, p]) => `  ${id}: ${p.label}`)
        .join("\n"),
    );
    options.profile = await ask("技术模板", "fullstack-react");
  }
  options.ai ??= await ask("AI 能力：none / chat / rag / agent", "none");
  options.database ??= await ask("数据库：none / postgres", "none");
  options.agents ??= await ask(
    "编程助手 ID，逗号分隔；all 可选择全部映射",
    "codex,claude-code,cursor",
  );
  console.log(
    "可选第三方 Skills（需要网络，固定来源版本）：" +
      recommendSkills(options)
        .map((s) => s.name)
        .join(", "),
  );
  options.skills ??= await ask(
    "Skills：recommended / none / 逗号分隔的名称",
    "recommended",
  );
  if (options.skills === "recommended") delete options.skills;
  return { options, destination };
}
function savePlan(root, plan) {
  console.log(formatPlan(plan));
  write(root, ".ai-project/plan.json", json(plan));
  console.log(`\n计划已保存。应用：ai-project apply ${JSON.stringify(root)}`);
}
function mergeManagedLock(root, desired) {
  const plan = planFiles(root, desired);
  const file = ".ai-project/skills-lock.json";
  if (plan.conflicts.some((c) => c.file === file)) {
    plan.conflicts = plan.conflicts.filter((c) => c.file !== file);
    const before = read(root, file);
    plan.changes.push({
      file,
      before,
      after: desired[file],
      beforeHash: hash(before),
    });
  }
  return plan;
}
export async function main(argv = process.argv.slice(2)) {
  const { values: options, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: Object.fromEntries([
      ...[
        "profile",
        "ai",
        "database",
        "agents",
        "skills",
        "name",
        "project",
        "ref",
        "subdir",
        "extension",
      ].map((name) => [name, { type: "string" }]),
      ...["yes", "json", "help", "version", "install"].map((name) => [
        name,
        { type: "boolean" },
      ]),
    ]),
  });
  if (options.help) {
    console.log(help);
    return;
  }
  if (options.version) {
    console.log("0.1.0");
    return;
  }
  let [command, argument, extra] = positionals;
  if (!command) {
    if (process.stdin.isTTY) {
      command = await ask(
        "操作：init 新建 / inspect 检查 / plan 改造预览",
        "init",
      );
      if (["inspect", "plan"].includes(command))
        argument = await ask("项目目录", ".");
    } else {
      console.log(help);
      return;
    }
  }
  if (command === "agents") {
    console.log(
      options.json
        ? json(agentCatalog)
        : agentCatalog.agents
            .map((a) => `${a.id.padEnd(20)} ${a.skillsDir} [${a.status}]`)
            .join("\n"),
    );
    return;
  }
  if (command === "templates") {
    console.log(
      options.json
        ? json(profiles)
        : Object.entries(profiles)
            .map(([id, p]) => `${id.padEnd(20)} ${p.label}`)
            .join("\n") +
            "\n支持 AI: none/chat/rag/agent（Python 基础模板除外）；数据库: none/postgres（Python 除外）。\n移动/桌面原生安装包尚未认证。",
    );
    return;
  }
  if (command === "init") {
    const result = await wizard(options, argument);
    argument = result.destination;
    if (!argument) throw new Error("请提供目标目录");
    const root = path.resolve(argument),
      name = options.name ?? path.basename(root);
    safePath(root, "package.json");
    if (fs.existsSync(root) && fs.readdirSync(root).length)
      throw new Error("新建仅允许空目录；已有项目请使用 inspect / plan");
    const config = {
      name,
      profile: options.profile ?? "fullstack-react",
      ai: options.ai ?? "none",
      database: options.database ?? "none",
      agents: options.agents,
      skills: options.skills,
    };
    if (options.skills === "recommended") {
      delete options.skills;
      delete config.skills;
    }
    const requested =
      options.skills && options.skills !== "none"
        ? options.skills.split(",")
        : [];
    const externalNames = requested.filter((name) => !builtins[name]);
    for (const name of externalNames)
      if (!curatedSkills.some((skill) => skill.name === name))
        throw new Error("未知精选 Skill: " + name);
    const files = generate({
      ...config,
      skills: externalNames.length
        ? requested.filter((name) => builtins[name]).join(",") || "none"
        : config.skills,
    });
    if (externalNames.length) {
      const lock = JSON.parse(files[".ai-project/skills-lock.json"]);
      const targets = selectedAgents(config.agents);
      for (const name of externalNames) {
        console.log("下载固定版本 Skill: " + name);
        const skill = resolveSkill(name);
        const { skillFiles } = await import("./skills.js");
        const output = skillFiles(skill, targets);
        Object.assign(files, output);
        lock.skills.push({
          name: skill.name,
          source: skill.source,
          revision: skill.revision,
          integrity: skill.integrity,
          agents: targets.map((a) => a.id),
          files: Object.fromEntries(
            Object.entries(output).map(([file, content]) => [
              file,
              hash(content),
            ]),
          ),
        });
      }
      files[".ai-project/skills-lock.json"] = json(lock);
    }
    if (options.extension) {
      const extension = loadExtension(path.resolve(options.extension), config);
      for (const [file, content] of Object.entries(extension.files)) {
        if (file in files && !extension.manifest.overrides?.includes(file))
          throw new Error("扩展覆盖内置文件需在 overrides 明示: " + file);
        files[file] = content;
      }
      files[".ai-project/extension.json"] = json({
        ...extension.manifest,
        status: "not-verified",
        source: path.resolve(options.extension),
      });
    }
    files[".ai-project/recommended-skills.json"] = json(
      recommendSkills(config),
    );
    fs.mkdirSync(root, { recursive: true });
    for (const [file, content] of Object.entries(files))
      write(root, file, content);
    console.log(
      `已创建 ${root}\n模板 ${config.profile}；AI ${config.ai}；数据库 ${config.database}\n生成不代表验证完成。`,
    );
    if (options.install) {
      npmRun(["install"], { cwd: root });
      if (profiles[config.profile].python)
        execFileSync("uv", ["sync"], {
          cwd: root,
          stdio: "inherit",
          timeout: 300000,
        });
      npmRun(["run", "format"], { cwd: root, timeout: 60000 });
    }
    console.log(
      "下一步：安装依赖、运行 npm run format 和 npm run check，提交生成的锁文件。",
    );
    return;
  }
  if (command === "verify") {
    const root = path.resolve(argument ?? ".");
    const pkg = JSON.parse(read(root, "package.json") ?? "{}");
    if (!pkg.scripts?.check)
      throw new Error("项目缺少 check 命令；请先配置实际质量检查");
    const report = {
      schemaVersion: 1,
      at: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      command: "npm run check",
      status: "failed",
      packageHash: hash(read(root, "package.json")),
    };
    try {
      npmRun(["run", "check"], { cwd: root });
      report.status = "passed";
    } catch {
      process.exitCode = 1;
    }
    write(root, ".ai-project/verification.json", json(report));
    console.log(
      "质量检查: " + report.status + "。此结果只覆盖该命令实际执行的检查。",
    );
    return;
  }
  if (command === "inspect") {
    const report = inspect(path.resolve(argument ?? "."));
    console.log(
      options.json
        ? json(report)
        : report.summary +
            "\n技术栈: " +
            (report.stacks.join(", ") || "未识别") +
            "\n" +
            report.checks
              .map(
                (c) =>
                  `${c.status === "present" ? "✓" : "✗"} ${c.id}: ${c.detail}`,
              )
              .join("\n"),
    );
    if (report.checks.some((c) => c.status === "missing")) process.exitCode = 2;
    return;
  }
  if (command === "plan") {
    const root = path.resolve(argument ?? ".");
    if (options.extension) {
      const saved = JSON.parse(read(root, ".ai-project/project.json") ?? "{}");
      const config = {
        profile: options.profile ?? saved.profile,
        ai: options.ai ?? saved.ai ?? "none",
        database: options.database ?? saved.database ?? "none",
      };
      if (!config.profile)
        throw new Error(
          "扩展改造需要 --profile 或已有项目元数据，不能猜测兼容性",
        );
      const extension = loadExtension(
        path.resolve(options.extension),
        config,
        "migrate",
      );
      savePlan(
        root,
        planFiles(root, extension.files, {
          mergePackage: true,
          mergeGuidance: true,
        }),
      );
      return;
    }
    if (read(root, "package.json") === null)
      throw new Error(
        "首版自动改造支持具有 package.json 的项目；其他语言可检查，但需扩展改造器",
      );
    const desired = retrofitFiles();
    // Do not inject ESM config into a CommonJS project.
    if (JSON.parse(read(root, "package.json")).type !== "module") {
      desired["eslint.config.mjs"] = desired["eslint.config.js"];
      delete desired["eslint.config.js"];
    }
    for (const file of [
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
      ".eslintrc",
      ".eslintrc.json",
      ".eslintrc.js",
      ".eslintrc.cjs",
    ]) {
      if (read(root, file) !== null && !(file in desired))
        throw new Error(
          "检测到已有 ESLint 配置 " +
            file +
            "；需手动或专用扩展合并，避免引入冲突规则",
        );
    }
    savePlan(
      root,
      planFiles(root, desired, { mergePackage: true, mergeGuidance: true }),
    );
    return;
  }
  if (command === "apply") {
    const root = path.resolve(argument ?? ".");
    const plan = JSON.parse(read(root, ".ai-project/plan.json") ?? "null");
    if (!plan) throw new Error("未找到计划，请先运行 plan 或 skills add");
    console.log(formatPlan(plan));
    if (!(await confirmed(options.yes))) {
      console.log("已取消");
      return;
    }
    const id = applyPlan(root, plan);
    console.log(
      id
        ? `已应用。恢复命令：ai-project rollback ${id} --project ${JSON.stringify(root)}\n请安装/更新依赖锁文件并运行质量检查。`
        : "无改动",
    );
    return;
  }
  if (command === "rollback") {
    const root = path.resolve(options.project ?? ".");
    rollback(root, argument);
    console.log("已恢复本次改动；未删除空目录。");
    return;
  }
  if (command === "skills") {
    if (argument === "list") {
      console.log(
        Object.entries(builtins)
          .map(([name, [description]]) => `${name}: ${description} [内置]`)
          .join("\n"),
      );
      console.log(
        "\n固定来源的第三方目录（按需下载）：\n" +
          curatedSkills
            .map(
              (skill) =>
                `${skill.name}: ${skill.tags.join(", ")} — ${skill.source}@${skill.revision.slice(0, 8)}`,
            )
            .join("\n"),
      );
      return;
    }
    if (argument !== "add" || !extra)
      throw new Error("用法: skills add <内置名|本地目录|HTTPS Git URL>");
    const root = path.resolve(options.project ?? ".");
    if (!fs.existsSync(root)) throw new Error("项目目录不存在");
    const config = JSON.parse(read(root, ".ai-project/project.json") ?? "{}");
    const agents = selectedAgents(options.agents ?? config.agents?.join(","));
    const skill = resolveSkill(extra, options);
    const desired = installSkillFiles(root, skill, agents);
    const plan = mergeManagedLock(root, desired);
    savePlan(root, plan);
    if (options.yes && !plan.conflicts.length)
      console.log("已应用，备份: " + applyPlan(root, plan));
    return;
  }
  throw new Error("未知命令: " + command + "\n" + help);
}
