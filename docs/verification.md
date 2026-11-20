# 验证记录

日期：2026-11-20。环境：macOS arm64，Node.js 26.13.1。基础版本已通过 GitHub Actions 的 Node 22/24、Linux/macOS/Windows 矩阵；0.2 变更将重新运行。

| 验证对象                | 实际执行                                                                        | 结果                                                                      |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| CLI                     | ESLint、Prettier、17 项自动测试                                                 | 通过                                                                      |
| 289 种允许参数组合      | 生成、质量命令、文件与元数据断言                                                | 通过；不是 289 次完整构建认证                                             |
| React / Vue 网页        | 安装、格式化、Lint、单测、Vite 构建                                             | 通过                                                                      |
| React / Vue 网页        | Playwright Chromium 页面加载、无 JS 异常、键盘链接聚焦                          | 通过                                                                      |
| Node API + Agent        | 安装、Lint、HTTP 测试、配置校验、模型响应校验、工具拒绝、步数限制、fixture 评测 | 通过                                                                      |
| React / Vue 全栈基础版  | 安装、Lint、测试、构建                                                          | 通过                                                                      |
| FastAPI                 | uv sync、Ruff、mypy、pytest、compileall                                         | 通过（Python 3.12）                                                       |
| Expo                    | 安装、Lint、测试、Web 导出、expo install --check                                | 通过；未验证 iOS/Android 真机                                             |
| Electron                | 安装、Lint、测试、Vite 渲染端构建                                               | 通过；另已生成 macOS arm64 未签名原生应用包，未做签名、公证和真机发布验证 |
| Node + RAG + PostgreSQL | 基础检查、fixture 评测、真实 PostgreSQL 17 迁移、重复执行、修改历史迁移拒绝     | 通过；测试容器已清理                                                      |
| 第三方 Skill            | 从固定 Vercel commit 导入 React Best Practices 并记录哈希                       | 通过；未执行 Skill 中的指令或脚本                                         |
| 助手适配                | 固定上游版本的 79 个项目路径映射、生成哈希一致性                                | 通过；客户端实际加载未逐一验证                                            |

详细本地日志位于 `.artifacts/smoke/`，不纳入 npm 发布包。真实模型调用需要用户的模型服务与评测预算，本轮未执行；fixture 通过不能代表模型效果。源码中的 secret-pattern 检查是基础辅助，不能替代完整安全审计。

## 0.2 新增验证

- Next.js、Nuxt、Astro：依赖安装、格式化、Lint、测试、构建；浏览器检查分别运行。
- Express + SQLite + Agent、Fastify + SQLite + RAG 工作区、React 全栈 + SQLite + Chat 工作区：安装与完整基础检查通过。
- 真实终端交互：单选、多选、方案摘要、取消不创建文件、确认创建及安装日志流程已走通。
- 289 种允许参数组合通过生成结构与基础质量入口断言，仍不等同于 289 个组合全部完成端到端认证。
