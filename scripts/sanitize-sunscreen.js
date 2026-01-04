// sanitize-sunscreen.js
// Pure sanitation + detection logic for sunscreen submissions

import { UV_FILTERS, UV_FILTER_IGNORE } from "./shared/uv-filters.js";
import { fileURLToPath } from "url";

/**
 * Normalize a string for comparison
 */
function normalize(str) {
  return str.trim().toLowerCase();
}

/**
 * Title-case an INCI name safely
 */
function titleCaseInci(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Determine whether an ingredient is explicitly ignored
 */
function isIgnoredIngredient(name) {
  return UV_FILTER_IGNORE.includes(normalize(name));
}

/**
 * Find a known UV filter match by INCI or alias
 */
function findKnownFilter(ingredient) {
  const norm = normalize(ingredient);

  return UV_FILTERS.find(filter => {
    if (normalize(filter.inci) === norm) return true;
    if (filter.aka) {
      return filter.aka.some(alias => normalize(alias) === norm);
    }
    return false;
  });
}

/**
 * Conservative heuristic for "possible UV filter"
 */
function looksLikeUvFilter(name) {
  const n = normalize(name);

  const keywords = [
    "triazone",
    "triazine",
    "benzotriazol",
    "benzophenone",
    "cinnamate",
    "salicylate",
    "benzylidene"
  ];

  return keywords.some(k => n.includes(k));
}

/**
 * Strip brand name from beginning of product name
 */
function stripBrandFromProduct(product, brand, warnings) {
  const brandNorm = normalize(brand);
  const productNorm = normalize(product);

  if (productNorm.startsWith(brandNorm)) {
    const stripped = product.slice(brand.length).trim();
    if (stripped) {
      warnings.push({
        type: "brand-removed-from-product",
        brand
      });
      return stripped.replace(/^[\s\-:–]+/, "").trim();
    }
  }

  return product;
}

/**
 * Strip SPF / PA annotations from product name
 */
function stripSpfPaFromProduct(product, warnings) {
  const original = product;

  const cleaned = product
    // Remove SPF patterns
    .replace(/\bSPF\s*\d+\+?\b/gi, "")
    // Remove PA patterns
    .replace(/\bPA\+{1,4}\b/gi, "")
    // Remove empty parentheses / dashes left behind
    .replace(/[\(\)\-–]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (cleaned !== original) {
    warnings.push({
      type: "spf-pa-removed-from-product",
      original
    });
  }

  return cleaned;
}

/**
 * Main sanitizer entry point
 */
export function sanitizeSunscreen(raw) {
  const warnings = [];

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid sunscreen object");
  }

  const sunscreen = structuredClone(raw);

  // ----------------------------
  // REQUIRED FIELDS (FATAL)
  // ----------------------------

  const required = ["id", "brand", "product", "type", "ingredients"];

  for (const field of required) {
    if (!sunscreen[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!Array.isArray(sunscreen.ingredients)) {
    throw new Error("ingredients must be an array");
  }

  // ----------------------------
  // PRODUCT NAME SANITATION
  // ----------------------------

  sunscreen.product = stripBrandFromProduct(
    sunscreen.product,
    sunscreen.brand,
    warnings
  );

  sunscreen.product = stripSpfPaFromProduct(
    sunscreen.product,
    warnings
  );

  if (!sunscreen.product) {
    throw new Error("Product name empty after sanitation");
  }

  // ----------------------------
  // INGREDIENT NORMALIZATION
  // ----------------------------

  sunscreen.ingredients = sunscreen.ingredients
    .map(i => (typeof i === "string" ? i.trim() : ""))
    .filter(Boolean);

  if (sunscreen.ingredients.length === 0) {
    throw new Error("ingredients array is empty after normalization");
  }

  // ----------------------------
  // UV FILTER DETECTION
  // ----------------------------

  const detectedFilters = new Map();

  for (const ingredient of sunscreen.ingredients) {
    if (isIgnoredIngredient(ingredient)) {
      continue;
    }

    const known = findKnownFilter(ingredient);

    if (known) {
      detectedFilters.set(normalize(known.inci), {
        name: titleCaseInci(known.inci),
        category: known.type
      });
      continue;
    }

    if (looksLikeUvFilter(ingredient)) {
      warnings.push({
        type: "unknown-uv-filter",
        ingredient
      });
    }
  }

  // ----------------------------
  // MERGE WITH DECLARED FILTERS
  // ----------------------------

  const declaredFilters = new Map();

  if (Array.isArray(sunscreen.filters)) {
    for (const f of sunscreen.filters) {
      if (!f?.name) continue;
      declaredFilters.set(normalize(f.name), f);
    }
  }

  for (const [key, filter] of detectedFilters.entries()) {
    if (!declaredFilters.has(key)) {
      warnings.push({
        type: "inferred-filter",
        filter: filter.name
      });
      declaredFilters.set(key, filter);
    }
  }

  sunscreen.filters = Array.from(declaredFilters.values());

  // ----------------------------
  // FINAL NORMALIZATION
  // ----------------------------

  sunscreen.brand = sunscreen.brand.trim();
  sunscreen.product = sunscreen.product.trim();
  sunscreen.type = sunscreen.type.toLowerCase();

  return {
    sunscreen,
    warnings
  };
}
