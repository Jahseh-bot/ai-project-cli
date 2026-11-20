#!/usr/bin/env node
import { main } from "../src/cli.js";
main().catch((error) => {
  console.error("\n错误: " + error.message);
  process.exitCode = 1;
});
