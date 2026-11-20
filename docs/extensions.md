# 扩展包

目前支持本地声明式扩展目录；可将 Git 仓库检出到固定版本后传入。扩展包不包含 CLI 运行时插件代码。

```json
{
  "schemaVersion": 1,
  "name": "team-standard",
  "version": "1.0.0",
  "compatibility": {
    "profile": ["fullstack-react"],
    "ai": ["none", "chat"],
    "database": ["none"]
  },
  "files": {
    "docs/team.md": "files/team.md"
  },
  "migrationFiles": {
    "docs/team.md": "files/team.md"
  },
  "overrides": [],
  "checks": ["npm run check"]
}
```

保存为 `extension.json`，将内容放入 `files/team.md`：

```sh
ai-project init my-app --profile fullstack-react --extension ./team-standard --yes
```

覆盖内置文件必须在 `overrides` 明确列出。扩展不能覆盖 `.ai-project/` 元数据。扩展校验通过只说明结构与兼容声明有效；所有扩展生成组合默认标为未验证，需要独立运行检查。首版扩展叠加在现有基础模板上，新增 CLI 行为需要修改源码。

## 已有项目改造

扩展可以通过 `migrationFiles` 声明改造文件映射。已有项目同样走预览、确认、冲突保护和备份流程，不执行任意迁移脚本。

```sh
ai-project plan ./existing-app --profile fullstack-react --extension ./team-standard
ai-project apply ./existing-app
```

若项目没有生成器元数据，必须显式指定 `--profile`。`package.json` 仅合并不冲突的脚本和开发依赖；其他冲突不会被覆盖。需要迁移业务代码的扩展必须提供人工可审查的步骤，本接口不猜测代码语义。
