#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prototypeSourceDirectory = join(
  repoRoot,
  "prototypes/mobile-sound-design-wireframe/src",
);

async function listCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listCssFiles(path);
    return extname(entry.name) === ".css" ? [path] : [];
  }));
  return files.flat();
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.includes("style-contract-allow-raw") ? comment : "");
}

function duplicateSelectors(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack = [];
  const selectors = new Map();
  const duplicates = [];
  let buffer = "";

  for (const character of clean) {
    if (character === "{") {
      const prelude = buffer.trim().replace(/\s+/g, " ");
      buffer = "";
      if (prelude.startsWith("@")) {
        stack.push({ kind: "at-rule", name: prelude });
        continue;
      }

      const context = stack
        .filter((item) => item.kind === "at-rule")
        .map((item) => item.name)
        .join(" > ");
      const key = context + " :: " + prelude;
      if (selectors.has(key)) duplicates.push(prelude);
      else selectors.set(key, true);
      stack.push({ kind: "rule", name: prelude });
      continue;
    }

    if (character === "}") {
      stack.pop();
      buffer = "";
      continue;
    }

    if (character === ";") {
      buffer = "";
      continue;
    }

    buffer += character;
  }

  return duplicates;
}

function rawValueViolations(source) {
  const violations = [];
  const lines = source.split("\n");
  const unitPattern = /-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|ch|vh|vw|dvh|svh|lvh)\b/g;
  const colorPattern = /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi;

  lines.forEach((line, index) => {
    if (line.includes("style-contract-allow-raw")) return;
    const units = line.match(unitPattern) || [];
    const colors = line.match(colorPattern) || [];
    for (const value of [...units, ...colors]) {
      violations.push({ line: index + 1, value });
    }
  });

  return violations;
}

const files = await listCssFiles(prototypeSourceDirectory);
const errors = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const displayPath = relative(repoRoot, file);
  const clean = stripComments(source);

  if (/!important\b/.test(clean)) {
    errors.push(displayPath + ": !important is forbidden");
  }

  for (const selector of duplicateSelectors(source)) {
    errors.push(displayPath + ": duplicate selector in the same scope: " + selector);
  }

  if (file.endsWith("tokens.css")) continue;
  for (const violation of rawValueViolations(source)) {
    errors.push(
      displayPath + ":" + violation.line +
      ": raw value " + violation.value + " must be a named token",
    );
  }
}

if (errors.length > 0) {
  console.error("Cosimo style contract failed:\n\n" + errors.map((error) => "- " + error).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Cosimo style contract passed for " + files.length + " prototype CSS file" +
    (files.length === 1 ? "" : "s") + ".",
  );
}
