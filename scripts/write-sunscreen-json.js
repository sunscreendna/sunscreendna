import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sanitizeSunscreen } from "./sanitize-sunscreen.js";

// ----------------------------
// ESM __dirname FIX
// ----------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------
// INPUT (from GitHub Actions)
// ----------------------------

const {
  SUNSCREEN_ID,
  SUNSCREEN_CANONICAL_JSON,
  SUNSCREEN_DRY_RUN
} = process.env;

if (!SUNSCREEN_ID || !SUNSCREEN_CANONICAL_JSON) {
  console.error(
    "❌ Missing required environment variables.\n" +
    "Expected SUNSCREEN_ID and SUNSCREEN_CANONICAL_JSON."
  );
  process.exit(1);
}

const DRY_RUN = SUNSCREEN_DRY_RUN === "true";

// ----------------------------
// DECODE CANONICAL OBJECT
// ----------------------------

let canonical;
try {
  canonical = JSON.parse(
    Buffer.from(SUNSCREEN_CANONICAL_JSON, "base64").toString("utf8")
  );
} catch (err) {
  console.error("❌ Failed to decode or parse SUNSCREEN_CANONICAL_JSON.");
  process.exit(1);
}

// ----------------------------
// INGREDIENT TOKEN MERGING
// ----------------------------

function mergeIngredientTokens(ingredients) {
  const merged = [];

  for (let i = 0; i < ingredients.length; i++) {
    const current = ingredients[i];
    const next = ingredients[i + 1];

    // Merge numeric fragments: "1" + "2-Hexanediol"
    if (
      /^\d+$/.test(current) &&
      typeof next === "string" &&
      /^[\d\-]/.test(next)
    ) {
      merged.push(`${current},${next}`);
      i++;
      continue;
    }

    // Merge ppm fragments: "2" + "202 ppm"
    if (
      /^\d+$/.test(current) &&
      typeof next === "string" &&
      /^\d+\s*ppm/i.test(next)
    ) {
      merged.push(`${current},${next}`);
      i++;
      continue;
    }

    merged.push(current);
  }

  return merged;
}

if (Array.isArray(canonical.ingredients)) {
  canonical.ingredients = mergeIngredientTokens(canonical.ingredients);
}

// ----------------------------
// SANITIZE SUNSCREEN (PURE)
// ----------------------------

let sanitized;
let warnings = [];

try {
  const result = sanitizeSunscreen(canonical);
  sanitized = result.sunscreen;
  warnings = result.warnings ?? [];
} catch (err) {
  console.error("❌ Sanitization failed:", err.message);
  process.exit(1);
}

// ----------------------------
// ENUM ENFORCEMENT (FATAL)
// ----------------------------

const ALLOWED_TYPES = ["chemical", "mineral", "hybrid"];

if (!ALLOWED_TYPES.includes(sanitized.type)) {
  console.error(
    `❌ Invalid sunscreen type "${sanitized.type}".\n` +
    `Allowed values: ${ALLOWED_TYPES.join(", ")}`
  );
  process.exit(1);
}

// ----------------------------
// EXPORT WARNINGS FOR WORKFLOW
// ----------------------------

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `sanitizer_warnings=${Buffer.from(
      JSON.stringify(warnings)
    ).toString("base64")}\n`
  );
}

// ----------------------------
// DRY RUN SUPPORT (NO SIDE EFFECTS)
// ----------------------------

if (DRY_RUN) {
  console.log("🧪 DRY RUN MODE ENABLED");
  console.log(JSON.stringify(sanitized, null, 2));
  process.exit(0);
}

// ----------------------------
// FILE PATH
// ----------------------------

const DATA_FILE = path.resolve(
  __dirname,
  "..",
  "data",
  "sunscreens.json"
);

// ----------------------------
// READ EXISTING DATA
// ----------------------------

let data = [];

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

    if (!Array.isArray(data)) {
      throw new Error("sunscreens.json is not an array");
    }
  } catch (err) {
    console.error("❌ Failed to read sunscreens.json:", err.message);
    process.exit(1);
  }
}

// ----------------------------
// DUPLICATE CHECK (FATAL)
// ----------------------------

if (data.some(item => item.id === SUNSCREEN_ID)) {
  console.error(
    "❌ Duplicate sunscreen detected.\n" +
    `An entry with id "${SUNSCREEN_ID}" already exists.`
  );
  process.exit(1);
}

// ----------------------------
// WRITE BACK TO FILE
// ----------------------------

console.log(`➕ Adding new sunscreen: ${SUNSCREEN_ID}`);
data.push(sanitized);

try {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2) + "\n",
    "utf-8"
  );
  console.log("✅ sunscreens.json updated successfully.");
} catch (err) {
  console.error("❌ Failed to write sunscreens.json:", err.message);
  process.exit(1);
}
