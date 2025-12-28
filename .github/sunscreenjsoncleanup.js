const fs = require("fs");

// === CONFIG ===
const INPUT_FILE = "sunscreens.json";
const OUTPUT_FILE = "sunscreens.cleaned.json";

// fields you want REMOVED
const FIELDS_TO_REMOVE = [
  "country",
  "hazard_score",
  "visible_light_protection",
  "white_cast",
  "texture_finish",
  "fragrance",
  "safety_scores",
  "barrier_support"
];

// field to sort by (must exist on all objects)
const SORT_FIELD = "brand"; // or "product", "id", etc.

// === HELPERS ===
function removeFields(obj) {
  const cleaned = {};
  Object.keys(obj)
    .filter(key => !FIELDS_TO_REMOVE.includes(key))
    .sort() // alphabetize keys
    .forEach(key => {
      cleaned[key] = obj[key];
    });
  return cleaned;
}

// === MAIN ===
const raw = fs.readFileSync(INPUT_FILE, "utf8");
const data = JSON.parse(raw);

const cleaned = data
  .map(removeFields)
  .sort((a, b) =>
    a[SORT_FIELD].localeCompare(b[SORT_FIELD], undefined, { sensitivity: "base" })
  );

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cleaned, null, 2));
console.log("✅ JSON cleaned and alphabetized");
