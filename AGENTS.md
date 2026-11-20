# Development rules

Read docs/architecture.md and docs/product-scope.md before changing module boundaries.
Run npm run check for CLI changes. For template changes run the affected generator smoke tests.
Never label a template as runtime-verified based only on file-existence tests.
Preserve user files during retrofit. Do not bypass a stale-plan or rollback conflict.
Never install global Skills or execute imported Skill scripts automatically.
Do not expose npm or model credentials in output.
If .codegraph/ exists at this repository root, use CodeGraph before exploring code. Otherwise skip it.
