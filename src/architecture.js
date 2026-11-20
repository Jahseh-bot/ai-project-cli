import { json } from "./files.js";
export function applyWorkspace(files, pkg, name) {
  const moved = {};
  for (const [file, content] of Object.entries(files)) {
    if (file.startsWith("src/modules/")) {
      moved[file.replace("src/modules/", "packages/domain/src/")] = content;
      delete files[file];
    }
    if (file.startsWith("src/ai/")) {
      moved[file.replace("src/ai/", "packages/ai/src/")] = content.replace(
        "'../../data/knowledge.json'",
        "'../../../data/knowledge.json'",
      );
      delete files[file];
    }
  }
  Object.assign(files, moved);
  for (const [file, content] of Object.entries(files)) {
    if (!/\.(js|mjs|cjs)$/.test(file)) continue;
    files[file] = content
      .replace(
        /(['"])(?:\.\.\/\.\.\/|\.\.\/|\.\/)src\/modules\/([a-z-]+)\.js\1/g,
        (_match, quote, module) => `${quote}@${name}/domain/${module}${quote}`,
      )
      .replace(
        /(['"])\.\/modules\/([a-z-]+)\.js\1/g,
        (_match, quote, module) => `${quote}@${name}/domain/${module}${quote}`,
      )
      .replace(
        /(['"])(?:\.\.\/src\/ai\/|\.\/ai\/)([a-z-]+)\.js\1/g,
        (_match, quote, module) => `${quote}@${name}/ai/${module}${quote}`,
      );
  }
  pkg.workspaces = ["packages/*"];
  files["packages/domain/package.json"] = json({
    name: `@${name}/domain`,
    version: "0.1.0",
    private: true,
    type: "module",
    exports: { "./*": "./src/*.js" },
  });
  if (Object.keys(moved).some((f) => f.startsWith("packages/ai/")))
    files["packages/ai/package.json"] = json({
      name: `@${name}/ai`,
      version: "0.1.0",
      private: true,
      type: "module",
      exports: { "./*": "./src/*.js" },
    });
  pkg.scripts.build = pkg.scripts.build.replace(
    "src/modules/",
    "packages/domain/src/",
  );
  files["docs/architecture.md"] +=
    "\n## Shared capability workspace\n\npackages/domain contains shared business behavior. packages/ai, when enabled, contains model adapters and workflows. Applications depend on package exports. Keep deployment and UI concerns outside shared packages; validate changes through the consuming applications. Root npm workspaces manages dependency linking and a single lockfile.\n";
}
