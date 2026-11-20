#!/usr/bin/env node
import { main } from "../src/cli.js";
main().catch((error) => {
  if (error.code === "CANCELLED") return;
  console.error("\n错误: " + error.message);
  process.exitCode = 1;
});
