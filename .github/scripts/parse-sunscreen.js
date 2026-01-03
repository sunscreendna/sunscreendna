import fs from "fs";
import { UV_FILTERS } from "./uv-filters.js";

/**
 * Extract the text that follows a given markdown section heading
 */
function extractSection(body, heading) {
  const regex = new RegExp(
    `### ${heading}\\n([\\s\\S]*?)(?=\\n### |$)`,
    "i"
  );
  const match = body.match(regex);
  if (!match) return null;

  return match[1]
    .replace(/```[a-z]*?/gi, "")
    .trim();
}

/**
 * Normalize yes/no values to boolean or null
 */
function normalizeYesNo(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

/**
 * Generate deterministic sunscreen ID (brand + product, no SPF/PA)
 */
function generateId(brand, product) {
  const normalize = (str) => {
    return str
      .toLowerCase()
      .replace(/\bspf\s*\d+\+?\b/gi, "")
      .replace(/\bpa\+{1,4}\b/gi, "")
      .replace(/[™®©]/g, "")
      .replace(/[\s/_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return `${normalize(brand)}-${normalize(product)}`;
}

/**
 * Split INCI ingredient string into array
 */
function splitIngredients(ingredients) {
  if (!ingredients) return [];

  return ingredients
    .split(",")
    .map(i => i.trim())
    .filter(Boolean);
}

/**
 * Detect UV filters from ingredient list
 */
function detectUvFilters(ingredients) {
  if (!ingredients) return [];

  const text = ingredients.toLowerCase();
  const detected = [];

  for (const filter of UV_FILTERS) {
    const names = [filter.inci, ...(filter.aka || [])];

    for (const name of names) {
      if (text.includes(name.toLowerCase())) {
        detected.push({
          name: filter.inci,
          category: filter.type
        });
        break;
      }
    }
  }

  return detected;
}

/**
 * Validate required fields
 */
function validateRequired(data) {
  const required = ["brand", "product_name", "ingredients_inci"];
  const missing = required.filter((f) => !data[f]);

  if (missing.length) {
    throw new Error(
      `Missing required fields: ${missing.join(", ")}`
    );
  }
}

/**
 * Derive sunscreen type from UV filters
 */
function deriveSunscreenType(uvFilters) {
  if (!uvFilters || uvFilters.length === 0) return null;

  const hasMineral = uvFilters.some(f => f.category === "mineral");
  const hasChemical = uvFilters.some(f => f.category === "chemical");

  if (hasMineral && hasChemical) return "hybrid";
  if (hasMineral) return "mineral";
  if (hasChemical) return "chemical";

  return null;
}

/**
 * Build canonical sunscreen object (dry run)
 */
function buildCanonical(data) {
  const uvFilters = detectUvFilters(data.ingredients_inci);
  const sunscreenType = deriveSunscreenType(uvFilters);
  const id = generateId(data.brand, data.product_name);

  return {
    id,

    brand: data.brand,
    product: data.product_name,

    type: sunscreenType, // mineral | chemical | hybrid | null

    spf: data.spf
      ? Number(data.spf.replace(/\D/g, "")) || null
      : null,

    pa: data.pa_rating || null,

    korean: normalizeYesNo(data.korean),

    filters: uvFilters,

    ingredients: splitIngredients(data.ingredients_inci),

    // editorial-only
    source_url: data.source_url || null,
    notes: data.notes || null
  };
}

/**
 * Write env vars for downstream GitHub Actions steps
 */
function exportEnv(key, value) {
  if (!process.env.GITHUB_ENV) return;

  fs.appendFileSync(
    process.env.GITHUB_ENV,
    `${key}=${value}\n`
  );
}

/**
 * Entry point (GitHub Actions)
 */
if (process.env.ISSUE_BODY) {
  try {
    const body = process.env.ISSUE_BODY;

    const parsed = {
      brand: extractSection(body, "Brand name"),
      product_name: extractSection(body, "Product name"),
      spf: extractSection(body, "SPF \\(if known\\)"),
      pa_rating: extractSection(body, "PA / UVA rating \\(if known\\)"),
      ingredients_inci: extractSection(body, "Ingredients \\(INCI\\)"),
      korean: extractSection(body, "Is this a Korean product\\?"),
      source_url: extractSection(body, "Source URL"),
      notes: extractSection(body, "Notes \\(optional\\)")
    };

    validateRequired(parsed);

    const canonical = buildCanonical(parsed);

    // 🔑 EXPORT FOR NEXT STEPS (Base64-safe)
    exportEnv("SUNSCREEN_ID", canonical.id);
    exportEnv("SUNSCREEN_BRAND", canonical.brand);
    exportEnv("SUNSCREEN_PRODUCT", canonical.product);
    exportEnv(
      "SUNSCREEN_CANONICAL_JSON",
      Buffer.from(JSON.stringify(canonical)).toString("base64")
    );

    console.log("🧪 Canonical sunscreen object (dry run):");
    console.log(JSON.stringify(canonical, null, 2));

    console.log("✅ Exported env vars:");
    console.log(`SUNSCREEN_ID=${canonical.id}`);
    console.log(`SUNSCREEN_BRAND=${canonical.brand}`);
    console.log(`SUNSCREEN_PRODUCT=${canonical.product}`);
    console.log("SUNSCREEN_CANONICAL_JSON=<base64>");
  } catch (err) {
    console.error("❌ Parsing failed:", err.message);
    process.exit(1);
  }
}
