import { json } from "./files.js";
export const extraProfiles = {
  "fullstack-next": {
    label: "Next.js · React 全栈",
    kind: "fullstack",
    framework: "next",
    ui: "react",
  },
  "fullstack-nuxt": {
    label: "Nuxt · Vue 全栈",
    kind: "fullstack",
    framework: "nuxt",
    ui: "vue",
  },
  "web-astro": {
    label: "Astro · 内容网站",
    kind: "web",
    framework: "astro",
    ui: "astro",
  },
  "api-express": {
    label: "Express · Node API",
    kind: "backend",
    api: true,
    server: "express",
  },
  "api-fastify": {
    label: "Fastify · Node API",
    kind: "backend",
    api: true,
    server: "fastify",
  },
};
export function applyFramework(files, pkg, profile) {
  if (profile.server) {
    const original = files["src/http.js"];
    const body = original
      .replace(
        "export function createApp() { return createServer(async (req, res) => {",
        "export async function handleRequest(req, res) {",
      )
      .replace(/\}\); \}\n$/, "}\n");
    if (profile.server === "express") {
      pkg.dependencies.express = "5.3.0";
      files["src/http.js"] =
        "import express from 'express';\n" +
        body +
        "export function createApp() { const app = express(); app.disable('x-powered-by'); app.use(handleRequest); return createServer(app); }\n";
    } else {
      pkg.dependencies.fastify = "5.12.8";
      files["src/http.js"] =
        "import Fastify from 'fastify';\nimport { Readable } from 'node:stream';\n" +
        body.replace("import { createServer } from 'node:http';\n", "") +
        "export async function createApp() { const app = Fastify({ bodyLimit: 16384 }); app.all('*', async (request, reply) => { reply.hijack(); const input = Object.assign(Readable.from([JSON.stringify(request.body ?? {})]), { method: request.method, url: request.url, headers: request.headers }); await handleRequest(input, reply.raw); }); await app.ready(); return app.server; }\n";
      files["apps/api/main.js"] = files["apps/api/main.js"].replace(
        "const server = createApp();",
        "const server = await createApp();",
      );
      files["tests/api.test.js"] = files["tests/api.test.js"].replace(
        "const app = createApp();",
        "const app = await createApp();",
      );
    }
  }
  if (!profile.framework) return;
  for (const file of [
    "index.html",
    "vite.config.js",
    "apps/web/main.js",
    "apps/web/style.css",
  ])
    delete files[file];
  delete pkg.devDependencies.vite;
  const content =
    "[h('h1', { key: 'heading' }, 'A clear starting point.'), h('p', { key: 'description' }, 'Build one useful feature, then verify it.'), h('a', { key: 'docs', href: 'https://developer.mozilla.org/' }, 'Explore web documentation')]";
  if (profile.framework === "next") {
    pkg.dependencies.next = "16.4.6";
    pkg.scripts.dev = "next dev --hostname 127.0.0.1";
    pkg.scripts.build = "next build";
    pkg.scripts.start = "next start --hostname 127.0.0.1";
    files["app/layout.js"] =
      "import { createElement as h } from 'react';\nimport './globals.css';\nexport const metadata = { title: 'Project workspace', description: 'A tested application starting point' };\nexport default function Layout({ children }) { return h('html', { lang: 'zh-CN' }, h('body', null, children)); }\n";
    files["app/page.js"] =
      "import { createElement as h } from 'react';\nexport default function Page() { return h('main', null, " +
      content +
      "); }\n";
    files["app/api/health/route.js"] =
      "export function GET() { return Response.json({ status: 'ok' }); }\n";
    files["next.config.mjs"] = 'export default { output: "standalone" };\n';
    files["app/globals.css"] =
      "body { font-family: system-ui; margin: 0; background: #102025; color: #f0f4ef; } main { max-width: 60rem; padding: 4rem 2rem; margin: auto; } h1 { font-size: clamp(2rem, 6vw, 4rem); } a { color: #a6e8c4; }\n";
  } else if (profile.framework === "nuxt") {
    pkg.dependencies.nuxt = "4.6.4";
    pkg.scripts.dev = "nuxt dev --host 127.0.0.1";
    pkg.scripts.build = "nuxt build";
    pkg.scripts.start = "node .output/server/index.mjs";
    files["app/app.vue"] =
      '<template><main><h1>A clear starting point.</h1><p>Build one useful feature, then verify it.</p><a href="https://developer.mozilla.org/">Explore web documentation</a></main></template>\n<style>body { font-family: system-ui; background: #102025; color: #f0f4ef; } main { max-width: 60rem; margin: auto; padding: 4rem 2rem; } h1 { font-size: clamp(2rem, 6vw, 4rem); } a { color: #a6e8c4; }</style>\n';
    files["nuxt.config.js"] =
      "export default { compatibilityDate: '2026-11-20', devtools: { enabled: false } };\n";
    files["server/api/health.get.js"] =
      "import { defineEventHandler } from 'h3';\nexport default defineEventHandler(() => ({ status: 'ok' }));\n";
    pkg.dependencies.h3 = "1.15.4";
  } else {
    pkg.dependencies = { ...pkg.dependencies, astro: "7.4.13" };
    delete pkg.dependencies.vue;
    pkg.scripts.dev = "astro dev --host 127.0.0.1";
    pkg.scripts.build = "astro build";
    pkg.scripts.start = "astro preview --host 127.0.0.1";
    files["src/pages/index.astro"] =
      '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Project workspace</title></head><body><main><h1>A clear starting point.</h1><p>Build one useful feature, then verify it.</p><a href="https://developer.mozilla.org/">Explore web documentation</a></main></body></html>\n<style>body { font-family: system-ui; background: #102025; color: #f0f4ef; } main { max-width: 60rem; margin: auto; padding: 4rem 2rem; } a { color: #a6e8c4; }</style>\n';
    files["astro.config.mjs"] =
      "import { defineConfig } from 'astro/config';\nexport default defineConfig({ output: 'static' });\n";
    // Astro formatting is handled by its own parser through Prettier's official ecosystem plugin.
    pkg.devDependencies["prettier-plugin-astro"] = "1.1.2";
    files[".prettierrc.json"] = json({ plugins: ["prettier-plugin-astro"] });
  }
  files[".gitignore"] += ".next/\n.nuxt/\n.output/\n.astro/\n";
  files[".prettierignore"] += ".next\n.nuxt\n.output\n.astro\n";
  files["eslint.config.js"] = files["eslint.config.js"].replace(
    "'dist/**'",
    "'dist/**', '.next/**', '.nuxt/**', '.output/**', '.astro/**'",
  );
  files["scripts/check-secrets.mjs"] = files[
    "scripts/check-secrets.mjs"
  ].replace("'.expo'", "'.expo', '.next', '.nuxt', '.output', '.astro'");
  files["playwright.config.js"] =
    "import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './e2e', use: { baseURL: 'http://127.0.0.1:4173' }, webServer: { command: 'npm run dev -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120000 } });\n";
  if (profile.framework === "astro")
    files["playwright.config.js"] = files["playwright.config.js"].replace(
      "npm run dev -- --port 4173",
      "npm run dev -- --port 4173 --ignore-lock",
    );
}
