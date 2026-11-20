# AI Project CLI

通过交互向导或命令行创建 Web、API、全栈、移动端和桌面端项目，配置基础质量保障与项目级 AI 开发 Skills。也支持检查已有项目，以及预览、应用和恢复配置改造。

**当前为 0.1.0 原型。** 不调用大模型。模板生成与构建验证、助手路径映射与客户端加载验证分别记录；不承诺任何未经验证的组合已具备生产可用性。当前包尚未发布到公共 npm。

## 使用

要求 Node.js 22.14+，推荐 Node.js 24 LTS。发布后：

```sh
npx @curveslink/ai-project-cli
```

发布前，本地使用：

```sh
npm ci
node bin/ai-project.js
```

或者打包并用 npx 测试实际分发包：

```sh
npm pack
npx --yes --package ./curveslink-ai-project-cli-0.1.0.tgz ai-project --help
```

非交互示例：

```sh
ai-project init my-app --profile fullstack-react --ai rag --database postgres --agents codex,claude-code,cursor --install --yes
ai-project init mobile-app --profile mobile-expo --agents codex --yes
ai-project init desktop-app --profile desktop-electron --agents cursor --yes
ai-project templates
ai-project agents
```

`--install` 安装依赖并格式化新项目，生成锁文件。它会运行包管理器正常的安装生命周期脚本；不传此选项只生成文件。`--yes` 用于无人值守操作，`apply --yes` 表示明确授权应用展示的计划。

## 技术组合

| 模板             | 技术                                | AI / 数据库                        |
| ---------------- | ----------------------------------- | ---------------------------------- |
| web-react        | React + Vite                        | 可附加 Node API                    |
| web-vue          | Vue + Vite                          | 可附加 Node API                    |
| api-node         | Node.js HTTP 服务                   | none/chat/rag/agent；none/postgres |
| api-python       | FastAPI + uv + Ruff + mypy + pytest | 首版基础 API                       |
| fullstack-react  | React + Node API                    | none/chat/rag/agent；none/postgres |
| fullstack-vue    | Vue + Node API                      | none/chat/rag/agent；none/postgres |
| mobile-expo      | React Native + Expo                 | 可附加 Node API                    |
| desktop-electron | Electron + React + Vite             | 可附加 Node API                    |

JS 项目使用 ESLint 静态检查、Prettier、Node 测试和实际构建；Web 模板增加 Playwright 端到端检查。Python 增加 Ruff、mypy、pytest。CI 使用已提交的锁文件。AI 模板提供输出校验、超时、工具白名单/步数预算、样例评测集和区分 fixture/live 的评测命令。

模板是可演进的基础应用。身份管理、多租户、生产级检索、持久任务队列、计费等需按产品规格补齐。React Native 原生设备构建、Electron 签名发布和真实模型效果不能用网页构建或 mock 测试替代。

## 已有项目

```sh
ai-project inspect ./existing-project
ai-project verify ./existing-project
ai-project plan ./existing-project
ai-project apply ./existing-project
ai-project rollback BACKUP_ID --project ./existing-project
```

- `inspect` 是静态清点，缺少约定配置时返回退出码 2；不会执行用户项目脚本。
- `plan` 保存差异，不修改目标配置。当前内置改造器支持 npm/package.json 项目；不会凭空声称已为未知语言完成测试和部署体系。
- `apply` 再次显示差异，确认后应用。存在冲突或预览后文件改变时，全部停止。
- 保留原有 package.json 字段、命令与依赖；同名不同值报告冲突。
- 原有忽略规则与 AGENTS.md 保留并追加。无法可靠合并的 ESLint/CI 配置需人工处理。
- `rollback` 仅恢复本次记录中的文件；若应用后文件又被修改，拒绝覆盖。
- 备份保存在 `.ai-project/backups/`，不要提交可能包含项目私有配置的备份。

## 开发 Skills

```sh
ai-project skills list
ai-project skills add quality-gates --project ./my-app --agents codex
ai-project skills add vercel-react-best-practices --project ./my-app --agents codex
ai-project skills add ./my-local-skill --project ./my-app
ai-project skills add https://github.com/OWNER/REPO --ref COMMIT --subdir skills/example --project ./my-app
ai-project apply ./my-app
```

只在项目内安装；默认先预览。`skills add ... --yes` 可显式应用。来源目录需包含有 `name`、`description` 的 `SKILL.md`，首版接受 UTF-8 文本文件与脚本但不执行它们。Git commit 或本地内容哈希锁定在 `.ai-project/skills-lock.json`；`inspect` 可检测内容漂移。同名不同来源/版本不会静默覆盖；自动升级与删除尚未实现。

内置 5 个原创基础 Skills：quality-gates、architecture-review、test-design、ai-evaluation、frontend-accessibility。另提供 10 个固定来源版本的第三方选项，来自 Vercel、Anthropic、Supabase、Expo；可在 `--skills` 中选择，也可用 `skills add` 单独安装。它们按需下载，目录记录来源与许可说明；固定来源不等同于已经审计所有执行行为。

助手路径目录取自固定 commit 的 [vercel-labs/skills](https://github.com/vercel-labs/skills)，来源与 revision 记录在 `catalog/agents.json`，上游许可见 `catalog/UPSTREAM-LICENSE.txt`。目前包含 79 个映射，包括 Codex、Claude Code、Cursor、Copilot、Gemini CLI、Cline、Roo、Kilo、Trae、Lingma、Qoder 等。**路径映射不等同于每个客户端已经现场加载验证。** `--agents all` 将写入全部映射目录，通常建议只选实际使用的工具。

## 扩展和维护

参见 [扩展格式](docs/extensions.md)、[架构](docs/architecture.md)、[产品范围](docs/product-scope.md) 和 [验证记录](docs/verification.md)。

```sh
npm run check
npm run smoke
npm pack
```

## 发布

包名暂定 `@curveslink/ai-project-cli`，需要具有该 scope 发布权限的 npm 账号：

```sh
npm login
npm whoami
npm run check
npm pack --dry-run
npm publish --access public
```

如账号不拥有该 scope，请先修改 package.json 的 name 和文档中的调用命令。不要把 npm token 写入仓库。
