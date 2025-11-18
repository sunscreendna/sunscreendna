async function loadSunscreens() {
  const response = await fetch("data/sunscreens.json");
  const sunscreens = await response.json();
  return sunscreens;
}

function displaySunscreens(list) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "sunscreen-card";
    div.innerHTML = `
      <h2>${item.brand} – ${item.product}</h2>
      <p><strong>Type:</strong> ${item.type}</p>
      <p><strong>Niacinamide?</strong> ${item.niacinamide}</p>
      <p><strong>Filters:</strong> ${item.filters.map(f => f.name).join(", ")}</p>
      <p><strong>Rosacea Safety:</strong> ${item.rosacea_safety}</p>
      <details>
        <summary>Ingredients</summary>
        <p>${item.ingredients.join(", ")}</p>
      </details>
      <p><em>${item.notes}</em></p>
    `;
    container.appendChild(div);
  });
}

function setupSearch(all) {
  const search = document.getElementById("search");

  search.addEventListener("input", () => {
    const term = search.value.toLowerCase();

    const filtered = all.filter(item =>
      item.brand.toLowerCase().includes(term) ||
      item.product.toLowerCase().includes(term) ||
      item.ingredients.some(ing => ing.toLowerCase().includes(term))
    );

    displaySunscreens(filtered);
  });
}

loadSunscreens().then(all => {
  displaySunscreens(all);
  setupSearch(all);
});
