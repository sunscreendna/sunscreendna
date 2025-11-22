//
//  LOAD SUNSCREENS
//
async function loadSunscreens() {
  try {
    console.log("Attempting to load sunscreens.json...");
    const response = await fetch("data/sunscreens.json");

    if (!response.ok) {
      console.error("Failed to load sunscreens.json:", response.status, response.statusText);
      return [];
    }

    const sunscreens = await response.json();
    console.log("Loaded sunscreens:", sunscreens);
    return sunscreens;
  } catch (err) {
    console.error("Fetch error:", err);
    return [];
  }
}

//
//  FORMAT INGREDIENT LINKS
//
function formatIngredientLink(ing) {
  const urlSlug = ing
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-");

  return `<a href="https://incidecoder.com/ingredients/${urlSlug}" target="_blank">${ing}</a>`;
}

//
//  DISPLAY SUNSCREENS
//
function displaySunscreens(list) {
  // 🔤 Sort alphabetically by Brand, then Product
  list.sort((a, b) => {
    const brandCompare = a.brand.localeCompare(b.brand);
    return brandCompare !== 0 ? brandCompare : a.product.localeCompare(b.product);
  });

  const container = document.getElementById("results");
  container.innerHTML = "";

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "sunscreen-card";

    // Ingredient links
    const ingredientLinks =
      item.ingredients?.map(ing => formatIngredientLink(ing)).join(", ") ??
      "No ingredient list provided.";

    // Safety score shortcuts
    const ss = item.safety_scores ?? {};
    const rosacea = ss.rosacea ?? {};
    const acne = ss.acne ?? {};
    const sensitive = ss.sensitive ?? {};

    // DYNAMIC REPORT LINK
    const reportLink = `https://github.com/kristimetz/kristimetz.github.io/issues/new?template=sunscreen-issue.md&title=Issue%20with%20sunscreen%3A%20${item.id}&body=**Sunscreen%20ID%3A**%20${item.id}`;

    div.innerHTML = `
      <h2>${item.brand} – ${item.product}</h2>

      <p><strong>SPF:</strong> ${item.spf ?? "Unknown"}</p>
      <p><strong>PA Rating:</strong> ${item.pa ?? "Unknown"}</p>
      <p><strong>Type:</strong> ${item.type ?? "Unknown"}</p>
      <p><strong>Texture/Finish:</strong> ${item.texture_finish ?? "Unknown"}</p>
      <p><strong>Country:</strong> ${item.country ?? "Unknown"}</p>

      <p><strong>Niacinamide?</strong> ${item.niacinamide ?? "Unknown"}</p>
      <p><strong>Barrier Support:</strong> ${item.barrier_support ?? "Unknown"}</p>
      <p><strong>Fragrance:</strong> ${item.fragrance ?? "Unknown"}</p>
      <p><strong>White Cast:</strong> ${item.white_cast ?? "Unknown"}</p>
      <p><strong>Visible Light Protection:</strong> ${item.visible_light_protection ?? "Unknown"}</p>
      <p><strong>Water Resistant:</strong> ${item.water_resistant ?? "Unknown"}</p>

      <details>
        <summary><strong>Safety Scores</strong></summary>

        <p><strong>Rosacea:</strong><br>
          • Stinging: ${rosacea.stinging ?? "Unknown"}<br>
          • Flushing: ${rosacea.flushing ?? "Unknown"}<br>
          • Barrier Impact: ${rosacea.barrier ?? "Unknown"}
        </p>

        <p><strong>Acne:</strong><br>
          • Comedogenicity: ${acne.comedogenicity ?? "Unknown"}<br>
          • Fungal Acne: ${acne.fungal_acne ?? "Unknown"}
        </p>

        <p><strong>Sensitive Skin:</strong><br>
          • Fragrance: ${sensitive.fragrance ?? "Unknown"}<br>
          • Essential Oils: ${sensitive.essential_oils ?? "Unknown"}<br>
          • Surfactant Strength: ${sensitive.surfactant_strength ?? "Unknown"}
        </p>
      </details>

      <details>
        <summary><strong>Ingredients</strong></summary>
        <p>${ingredientLinks}</p>
      </details>

      <p style="margin-top: 10px;">
        <a href="${reportLink}" target="_blank" rel="noopener noreferrer">
          📣 Report an Issue with This Sunscreen
        </a>
      </p>

      <p><em>${item.notes ?? ""}</em></p>
    `;

    container.appendChild(div);
  });
}

//
//  SEARCH FUNCTION
//
function setupSearch(all) {
  const search = document.getElementById("search");

  search.addEventListener("input", () => {
    const term = search.value.toLowerCase();

    const filtered = all.filter(item =>
      item.brand.toLowerCase().includes(term) ||
      item.product.toLowerCase().includes(term) ||
      item.ingredients?.some(ing => ing.toLowerCase().includes(term))
    );

    displaySunscreens(filtered);
  });
}

//
//  BRAND LIST (3-column clickable directory)
//
function displayBrandList(all) {
  const brandContainer = document.getElementById("brand-list");

  // Unique brand names, sorted
  const brands = [...new Set(all.map(item => item.brand))].sort();

  // Build clickable links
  brandContainer.innerHTML = brands
    .map(brand => `<a href="#" data-brand="${brand}">${brand}</a>`)
    .join("");

  // Click events: filter sunscreens by brand
  brandContainer.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const brand = e.target.dataset.brand;

      const filtered = all.filter(item => item.brand === brand);

      displaySunscreens(filtered);

      // Optional: show selection in the search bar
      document.getElementById("search").value = brand;
    });
  });
}

//
//  INITIALIZE PAGE
//
loadSunscreens().then(all => {
  console.log("Initializing page with:", all);

  displayBrandList(all);   // ⭐ NEW: Build brand list
  displaySunscreens();  // Show all sunscreens initially
  setupSearch(all);        // Enable search
});
