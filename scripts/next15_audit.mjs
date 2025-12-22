/* eslint-env node */
// scripts/next15_audit.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

// STRICT=1 => warnings => errors
const STRICT = process.env.NEXT15_AUDIT_STRICT === "1";

// Dossiers à ignorer
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  "_archive", // ✅ ignore vos routes archivées
]);

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      out.push(...walk(path.join(dir, ent.name)));
      continue;
    }

    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name);
    if (ext !== ".ts" && ext !== ".tsx") continue;

    out.push(path.join(dir, ent.name));
  }

  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

function hasUseSearchParams(code) {
  return code.includes("useSearchParams(");
}

function hasSuspenseInFile(code) {
  return code.includes("<Suspense");
}

function hasSearchParamsOptionalChaining(code) {
  return /searchParams\?\./.test(code);
}

function isAppPageOrLayout(file) {
  const p = file.replaceAll("\\", "/");
  return p.includes("/src/app/") && (p.endsWith("/page.tsx") || p.endsWith("/layout.tsx"));
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ src/ introuvable: ${SRC_DIR}`);
    process.exit(1);
  }

  const files = walk(SRC_DIR);

  const errors = [];
  const warnings = [];

  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");

    // ✅ Next 15: useSearchParams doit être rendu sous <Suspense> quelque part au-dessus.
    // Heuristique: on ne FAIL que si c'est un page/layout qui appelle le hook et n'a pas de <Suspense>.
    // Pour les composants (MessagesClient etc.), on WARNING seulement (le parent peut wrapper).
    if (hasUseSearchParams(code)) {
      if (isAppPageOrLayout(file) && !hasSuspenseInFile(code)) {
        errors.push({
          type: "missing_suspense_wrapper_for_useSearchParams",
          file,
          hint: "Ajoute <Suspense> dans page/layout autour du composant qui appelle useSearchParams().",
        });
      } else if (!hasSuspenseInFile(code)) {
        warnings.push({
          type: "useSearchParams_component_without_local_suspense",
          file,
          hint: "OK si un parent met <Suspense>. Sinon, wrapper dans le parent (page/layout) recommandé.",
        });
      }
    }

    // ✅ Standard interne: searchParams?.x -> warning (pas bloquant)
    if (hasSearchParamsOptionalChaining(code)) {
      warnings.push({
        type: "searchParams_optional_chaining_detected",
        file,
        hint: "Recommandé: éviter searchParams?.x ; préférer un pattern stable (sp = await searchParams) ou default {}.",
      });
    }
  }

  console.log("— Next.js 15 Audit —");
  console.log(`Scanned: ${files.length} files under ${rel(SRC_DIR)}`);
  console.log(`Mode: ${STRICT ? "STRICT (warnings => errors)" : "NORMAL"}`);

  if (warnings.length) {
    console.log("\n⚠️  WARNINGS:");
    for (const w of warnings) {
      console.log(`- ${w.type}: ${rel(w.file)}`);
      console.log(`  ↳ ${w.hint}`);
    }
  }

  const finalErrors = [...errors];

  if (STRICT && warnings.length) {
    for (const w of warnings) {
      finalErrors.push({
        type: `warning_as_error:${w.type}`,
        file: w.file,
        hint: w.hint,
      });
    }
  }

  if (finalErrors.length) {
    console.log("\n❌ ERRORS:");
    for (const e of finalErrors) {
      console.log(`- ${e.type}: ${rel(e.file)}`);
      console.log(`  ↳ ${e.hint}`);
    }
    console.log("\nResult: FAIL");
    process.exit(1);
  }

  console.log("\nResult: OK ✅");
  process.exit(0);
}

main();
