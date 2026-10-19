#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve, relative } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    err(`Cannot parse JSON: ${path} — ${e.message}`);
    return null;
  }
}

function extractFrontmatter(path) {
  const content = readFileSync(path, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fm;
}

function walkFiles(dir, exts) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) results.push(full);
  }
  return results;
}

const KEBAB = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

// Match Cursor's resolvePluginSourcePath: strip a leading "./", then always
// prepend metadata.pluginRoot. Source is relative to pluginRoot, not the repo root.
function resolvePluginSource(source, pluginRoot) {
  if (typeof source !== "string" || source.length === 0) return null;
  let path = source.startsWith("./") ? source.slice(2) : source;
  if (typeof pluginRoot === "string") {
    let root = pluginRoot.startsWith("./") ? pluginRoot.slice(2) : pluginRoot;
    if (root.endsWith("/")) root = root.slice(0, -1);
    if (root) path = `${root}/${path}`;
  }
  return path || ".";
}
// --- Marketplace manifest ---
const mpPath = join(ROOT, ".cursor-plugin", "marketplace.json");
if (!existsSync(mpPath)) {
  err("Missing .cursor-plugin/marketplace.json");
  process.exit(1);
}
const mp = readJSON(mpPath);
if (!mp) process.exit(1);

if (!mp.name || !KEBAB.test(mp.name)) err(`Marketplace name must be kebab-case, got: ${mp.name}`);
if (!mp.owner?.name) err("Marketplace owner.name is required");
if (!Array.isArray(mp.plugins) || mp.plugins.length === 0) err("Marketplace plugins array is empty");

// --- Validate each plugin ---
for (const entry of mp.plugins || []) {
  const resolvedSource = resolvePluginSource(entry.source, mp.metadata?.pluginRoot);
  if (!resolvedSource) {
    err(`Plugin ${entry.name ?? "(unnamed)"}: source must be a relative path string`);
    continue;
  }
  const pluginDir = resolve(ROOT, resolvedSource);
  const rel = relative(ROOT, pluginDir);

  if (!existsSync(pluginDir)) {
    err(`Plugin dir missing: ${rel} (source ${JSON.stringify(entry.source)} with pluginRoot ${JSON.stringify(mp.metadata?.pluginRoot ?? null)})`);
    continue;
  }
  const pjPath = join(pluginDir, ".cursor-plugin", "plugin.json");
  if (!existsSync(pjPath)) { err(`Missing plugin.json: ${rel}/.cursor-plugin/plugin.json`); continue; }

  const pj = readJSON(pjPath);
  if (!pj) continue;

  if (!KEBAB.test(pj.name)) err(`Plugin name not kebab-case: ${pj.name}`);
  if (pj.name !== entry.name) err(`Plugin name mismatch: marketplace="${entry.name}" vs plugin.json="${pj.name}"`);
  if (!pj.displayName) err(`Plugin ${pj.name}: missing displayName`);
  if (!pj.version) err(`Plugin ${pj.name}: missing version`);
  if (!pj.description) err(`Plugin ${pj.name}: missing description`);
  if (!pj.author?.name) err(`Plugin ${pj.name}: missing author.name`);

  if (pj.logo) {
    const logoPath = join(pluginDir, pj.logo);
    if (!existsSync(logoPath)) err(`Plugin ${pj.name}: logo not found at ${pj.logo}`);
  }

  // Rules
  for (const f of walkFiles(join(pluginDir, "rules"), [".md", ".mdc", ".markdown"])) {
    const fm = extractFrontmatter(f);
    if (!fm) err(`Rule missing frontmatter: ${relative(ROOT, f)}`);
    else if (!fm.description) err(`Rule missing description: ${relative(ROOT, f)}`);
  }

  // Skills
  for (const f of walkFiles(join(pluginDir, "skills"), ["SKILL.md"])) {
    const fm = extractFrontmatter(f);
    if (!fm) err(`Skill missing frontmatter: ${relative(ROOT, f)}`);
    else {
      if (!fm.name) err(`Skill missing name: ${relative(ROOT, f)}`);
      if (!fm.description) err(`Skill missing description: ${relative(ROOT, f)}`);
    }
  }

  // Agents
  for (const f of walkFiles(join(pluginDir, "agents"), [".md", ".mdc", ".markdown"])) {
    const fm = extractFrontmatter(f);
    if (!fm) err(`Agent missing frontmatter: ${relative(ROOT, f)}`);
    else {
      if (!fm.name) err(`Agent missing name: ${relative(ROOT, f)}`);
      if (!fm.description) err(`Agent missing description: ${relative(ROOT, f)}`);
    }
  }

  // Commands
  for (const f of walkFiles(join(pluginDir, "commands"), [".md", ".mdc", ".markdown", ".txt"])) {
    const fm = extractFrontmatter(f);
    if (!fm) warn(`Command missing frontmatter: ${relative(ROOT, f)}`);
    else {
      if (!fm.name) warn(`Command missing name: ${relative(ROOT, f)}`);
      if (!fm.description) warn(`Command missing description: ${relative(ROOT, f)}`);
    }
  }

  // Hooks
  const hooksPath = join(pluginDir, "hooks", "hooks.json");
  if (existsSync(hooksPath)) readJSON(hooksPath);
  else warn(`Plugin ${pj.name}: no hooks/hooks.json (optional)`);

  // MCP
  const mcpPath = join(pluginDir, "mcp.json");
  if (existsSync(mcpPath)) readJSON(mcpPath);
  else warn(`Plugin ${pj.name}: no mcp.json (optional)`);
}

// --- Report ---
console.log("");
if (warnings.length) {
  console.log(`⚠  ${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(`   ${w}`));
  console.log("");
}
if (errors.length) {
  console.log(`✗  ${errors.length} error(s):`);
  errors.forEach((e) => console.log(`   ${e}`));
  process.exit(1);
} else {
  console.log("✓  All validations passed.");
}
