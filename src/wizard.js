import * as ui from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { profiles } from "./templates.js";
import {
  agentCatalog,
  builtins,
  curatedSkills,
  recommendSkills,
} from "./skills.js";

export const families = [
  {
    value: "fullstack",
    label: "全栈应用",
    hint: "网站 + 服务端，适合 SaaS、后台和 AI 产品",
  },
  {
    value: "web",
    label: "Web 前端 / 内容网站",
    hint: "独立页面、管理界面、文档和营销网站",
  },
  {
    value: "backend",
    label: "API / AI 服务",
    hint: "接口、模型调用、RAG 和自动化服务",
  },
  { value: "mobile", label: "移动应用", hint: "面向 iOS / Android 的客户端" },
  {
    value: "desktop",
    label: "桌面应用",
    hint: "面向 macOS / Windows / Linux 的客户端",
  },
];
export const profileHints = {
  "web-react": "React + Vite · 轻量 SPA，适合交互界面",
  "web-vue": "Vue + Vite · 轻量 SPA，适合团队熟悉 Vue 时",
  "web-astro": "Astro · 内容优先，适合官网和文档站",
  "fullstack-react": "React + 独立 Node API · 前后端边界清楚，推荐",
  "fullstack-vue": "Vue + 独立 Node API · Vue 团队的分离式全栈",
  "fullstack-next": "Next.js · React 服务端渲染与文件路由",
  "fullstack-nuxt": "Nuxt · Vue 服务端渲染与文件路由",
  "api-node": "原生 Node HTTP · 依赖少，适合小型服务",
  "api-express": "Express · 中间件生态，适合常规 REST API",
  "api-fastify": "Fastify · 路由与插件体系，适合结构化 API",
  "api-python": "FastAPI · Python 生态，含类型检查和 pytest",
  "mobile-expo": "React Native + Expo · 共用客户端代码；需单独验证真机",
  "desktop-electron": "Electron + React · Web 技术构建桌面程序",
};
export const skillLabels = {
  "quality-gates": "质量门禁",
  "architecture-review": "架构审查",
  "test-design": "测试设计",
  "ai-evaluation": "AI 评测",
  "frontend-accessibility": "前端可访问性",
  "requirements-design": "需求与验收标准",
  "api-contracts": "API 契约设计",
  "security-review": "安全审查",
  observability: "日志与可观测性",
  "database-migrations": "数据库迁移",
  "release-engineering": "发布与回滚",
  "incident-debugging": "故障定位",
};
function value(result) {
  if (ui.isCancel(result)) {
    ui.cancel("已取消，没有应用改动。");
    const error = new Error("用户取消");
    error.code = "CANCELLED";
    throw error;
  }
  return result;
}
const select = async (options) => value(await ui.select(options));
const multi = async (options) => value(await ui.multiselect(options));
export async function chooseAction() {
  ui.intro("AI Project CLI · 从选择到可验证的工程起点");
  ui.note(
    "↑ ↓ 移动 · Enter 确认 · 多选时 Space 勾选 · Ctrl+C 退出\n所有 Skills 只写入项目。改造已有项目会先预览。",
    "操作提示",
  );
  const command = await select({
    message: "今天想完成什么？",
    options: [
      {
        value: "init",
        label: "创建新项目",
        hint: "选择技术架构、AI 能力与开发 Skills",
      },
      {
        value: "inspect",
        label: "检查已有项目",
        hint: "只读查看工程配置与缺失项",
      },
      {
        value: "plan",
        label: "补齐已有项目配置",
        hint: "先展示改动，不直接覆盖文件",
      },
      {
        value: "skills-menu",
        label: "为已有项目选择 Skills",
        hint: "按用途选择，预览后安装",
      },
      { value: "templates", label: "浏览技术方案", hint: "查看可生成的组合" },
      {
        value: "agents",
        label: "浏览编程助手适配",
        hint: "查看支持目录与验证状态",
      },
    ],
  });
  if (["inspect", "plan", "skills-menu"].includes(command)) {
    const directory = value(
      await ui.path({
        message: "选择已有项目目录",
        directory: true,
        initialValue: process.cwd(),
      }),
    );
    return { command, argument: directory };
  }
  return { command };
}
export async function confirmApply() {
  return value(
    await ui.confirm({
      message: "应用以上改动？会保留备份，冲突时停止。",
      initialValue: false,
    }),
  );
}
export async function pickAgents(initial = ["codex", "claude-code", "cursor"]) {
  const common = [
    "codex",
    "claude-code",
    "cursor",
    "github-copilot",
    "gemini-cli",
    "windsurf",
    "cline",
    "opencode",
    "trae",
    "lingma",
    "qoder",
    "roo",
    "kilo",
  ];
  const scope = await select({
    message: "选择编程助手范围",
    options: [
      {
        value: "common",
        label: "常用编程助手",
        hint: "Codex / Claude Code / Cursor / Copilot 等",
      },
      {
        value: "all",
        label: "完整适配目录",
        hint: `${agentCatalog.agents.length} 个目录映射；不等于逐客户端认证`,
      },
    ],
  });
  return multi({
    message: "选择你实际使用的助手（可多选）",
    initialValues: initial,
    options: agentCatalog.agents
      .filter((a) => scope === "all" || common.includes(a.id))
      .map((a) => ({ value: a.id, label: a.name, hint: "项目级 Skills" })),
    required: true,
  });
}
export async function pickSkills(config = {}) {
  const approach = await select({
    message: "如何配置开发 Skills？",
    options: [
      {
        value: "recommended",
        label: "推荐基础流程包",
        hint: "架构、需求、编码检查和测试；内置，无需下载",
      },
      {
        value: "custom",
        label: "按用途自由选择",
        hint: "内置流程 + Vercel / Anthropic / Supabase / Expo",
      },
      { value: "none", label: "暂不安装 Skills", hint: "代码质量检查仍然保留" },
    ],
  });
  if (approach !== "custom") return approach;
  const recommended = new Set(recommendSkills(config).map((s) => s.name));
  return (
    value(
      await ui.groupMultiselect({
        message: "选择开发流程（Space 勾选，Enter 完成）",
        required: false,
        initialValues: ["quality-gates", "architecture-review", "test-design"],
        options: {
          "内置 · 需求与工程保障": Object.keys(builtins).map((name) => ({
            value: name,
            label: skillLabels[name] ?? name,
            hint: "内置 · " + name,
          })),
          "第三方 · 当前技术栈推荐": curatedSkills
            .filter((s) => recommended.has(s.name))
            .map((s) => ({
              value: s.name,
              label: s.name,
              hint: "固定版本 · 需要下载",
            })),
          "第三方 · 其他专项能力": curatedSkills
            .filter((s) => !recommended.has(s.name))
            .map((s) => ({
              value: s.name,
              label: s.name,
              hint: s.tags.join(" / ") + " · 需要下载",
            })),
        },
      }),
    ).join(",") || "none"
  );
}
export async function setupWizard(input, destination) {
  if (!process.stdin.isTTY || input.yes) return { options: input, destination };
  ui.note(
    "先选用途，再选方案。每种方案都包含质量基线。\n只有项目名称和路径需要文字输入；技术配置全部使用选项。",
    "创建项目",
  );
  if (!destination) {
    const projectName = value(
      await ui.text({
        message: "项目名称",
        placeholder: "my-ai-app",
        defaultValue: "my-ai-app",
        validate: (name) =>
          /^[a-z][a-z0-9-]{0,63}$/.test(name || "my-ai-app")
            ? undefined
            : "使用小写字母开头，可包含数字和连字符，最多 64 位",
      }),
    );
    const location = await select({
      message: "项目放在哪里？",
      options: [
        {
          value: process.cwd(),
          label: "当前目录下的新文件夹",
          hint: path.join(process.cwd(), projectName),
        },
        { value: "choose", label: "选择其他父目录" },
      ],
    });
    const parent =
      location === "choose"
        ? value(
            await ui.path({
              message: "选择父目录",
              directory: true,
              initialValue: process.cwd(),
            }),
          )
        : location;
    destination = path.join(parent, projectName);
    if (fs.existsSync(destination) && fs.readdirSync(destination).length)
      throw new Error("目标目录非空，请选择新目录或使用已有项目改造");
  }
  let options;
  for (;;) {
    options = { ...input };
    if (!options.profile) {
      const family = await select({
        message: "1 / 7 · 项目主要是什么类型？",
        options: families,
      });
      options.profile = await select({
        message: "2 / 7 · 选择技术方案",
        initialValue: {
          fullstack: "fullstack-react",
          web: "web-react",
          backend: "api-express",
          mobile: "mobile-expo",
          desktop: "desktop-electron",
        }[family],
        options: Object.entries(profiles)
          .filter(([, p]) => p.kind === family)
          .map(([id, p]) => ({
            value: id,
            label: p.label,
            hint: profileHints[id],
          })),
      });
    }
    const python = profiles[options.profile]?.python;
    options.architecture ??= python
      ? "layered"
      : await select({
          message: "3 / 7 · 代码如何组织？",
          options: [
            {
              value: "layered",
              label: "模块化分层（推荐）",
              hint: "一个包，分开应用入口、业务模块、AI 和基础设施",
            },
            {
              value: "workspace",
              label: "共享能力工作区",
              hint: "npm workspaces，将业务与 AI 拆成可复用包",
            },
          ],
        });
    if (python) {
      options.ai ??= "none";
      options.database ??= "none";
      ui.note(
        "Python 方案当前提供基础 API 和质量体系。需要内置 AI / 数据库示例时，请选择 Node 系列方案。",
        "兼容范围",
      );
    }
    options.ai ??= await select({
      message: "4 / 7 · 是否添加 AI 功能？",
      options: [
        {
          value: "none",
          label: "通用应用",
          hint: "AI 辅助开发，但产品本身不调用模型",
        },
        {
          value: "chat",
          label: "模型对话",
          hint: "服务端模型适配、超时与输出校验",
        },
        {
          value: "rag",
          label: "知识库问答",
          hint: "本地检索示例、来源引用与评测起点",
        },
        {
          value: "agent",
          label: "工具型 Agent",
          hint: "工具白名单、循环预算与失败测试",
        },
      ],
    });
    options.database ??= await select({
      message: "数据存储",
      options: [
        {
          value: "none",
          label: "暂不添加数据库",
          hint: "适合页面、无状态 API 或先验证产品",
        },
        {
          value: "sqlite",
          label: "SQLite",
          hint: "本地文件，无需数据库服务，适合单机起步",
        },
        {
          value: "postgres",
          label: "PostgreSQL",
          hint: "独立数据库，含容器配置与迁移记录",
        },
      ],
    });
    ui.log.step("5 / 7 · 配置 AI 编程助手");
    options.agents ??= (await pickAgents()).join(",");
    ui.log.step("6 / 7 · 配置开发流程与 Skills");
    options.skills ??= await pickSkills(options);
    options.install ??= await select({
      message: "7 / 7 · 生成后做什么？",
      options: [
        {
          value: true,
          label: "安装依赖并初始化格式（推荐）",
          hint: "需要网络，随后可以运行质量检查",
        },
        { value: false, label: "只生成文件", hint: "稍后自行安装依赖" },
      ],
    });
    ui.note(
      [
        `位置  ${destination}`,
        `方案  ${profiles[options.profile].label}`,
        `架构  ${options.architecture === "workspace" ? "共享能力工作区" : "模块化分层"}`,
        `AI    ${{ none: "通用应用", chat: "模型对话", rag: "知识库问答", agent: "工具型 Agent" }[options.ai]}   数据库  ${{ none: "暂不添加", sqlite: "SQLite", postgres: "PostgreSQL" }[options.database]}`,
        `助手  ${options.agents
          .split(",")
          .map((id) => agentCatalog.agents.find((a) => a.id === id)?.name ?? id)
          .join(" / ")}`,
        `Skills  ${
          options.skills === "recommended"
            ? "推荐基础流程包"
            : options.skills === "none"
              ? "不安装"
              : options.skills
                  .split(",")
                  .map((name) => skillLabels[name] ?? name)
                  .join(" / ")
        }`,
        "质量基线  Lint · 格式检查 · 测试 · 构建 · CI",
        "生成后仍需执行检查；真机、真实模型与生产部署须另行验证。",
      ].join("\n"),
      "确认项目方案",
    );
    const decision = await select({
      message: "准备好了吗？",
      options: [
        { value: "create", label: "创建这个项目" },
        { value: "edit", label: "重新选择配置" },
        { value: "cancel", label: "取消" },
      ],
    });
    if (decision === "create") break;
    if (decision === "cancel") {
      ui.cancel("已取消，没有创建项目。");
      const error = new Error("用户取消");
      error.code = "CANCELLED";
      throw error;
    }
  }
  Object.assign(input, options);
  return { options: input, destination };
}
export function completion(root, installed) {
  ui.note(
    [
      `cd ${JSON.stringify(root)}`,
      ...(!installed ? ["npm install", "npm run format"] : []),
      "npm run check",
      "npm run dev",
    ].join("\n"),
    "下一步 · 启动与验证",
  );
  ui.outro("项目已生成。先通过质量检查，再开始添加业务功能。");
}

export function generationNotice(profile, root) {
  ui.log.success(profiles[profile].label + " · 项目文件已生成");
  ui.log.info(root);
}
