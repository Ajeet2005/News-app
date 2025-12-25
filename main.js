// ===================================
// SAMACHAR — GNews (Frontend-friendly)
// API key: provided by user
// Features:
// - Fixed 2s preloader (never stuck)
// - Nepal/World toggle
// - Category chips
// - Search (Enter)
// - 4x4 grid (16 cards) + placeholders
// - Load more (adds 16 more)
// - Image fallback + onerror fallback
// ===================================

const GNEWS_KEY = "c91daa379e433fec172f621afbafffba";

const TARGET_COUNT = 16;

const el = {
  preloader: document.getElementById("preloader"),
  progressBar: document.getElementById("progressBar"),
  loaderHint: document.getElementById("loaderHint"),

  blog: document.getElementById("blog-container"),
  status: document.getElementById("status"),

  searchInput: document.getElementById("search-input"),
  searchBtn: document.getElementById("search-button"),

  btnNepal: document.getElementById("btnNepal"),
  btnWorld: document.getElementById("btnWorld"),

  theme: document.getElementById("theme-toggle"),

  chips: Array.from(document.querySelectorAll(".chip")),
  loadMore: document.getElementById("load-more"),

  year: document.getElementById("year"),
};

el.year.textContent = new Date().getFullYear();

// ---------------- Theme ----------------
function setTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  el.theme.textContent = mode === "dark" ? "☀️" : "🌙";
  localStorage.setItem("samachar_theme", mode);
}
setTheme(localStorage.getItem("samachar_theme") || "dark");

el.theme.addEventListener("click", () => {
  setTheme(document.body.classList.contains("dark") ? "light" : "dark");
});

// ---------------- Preloader (Fixed) ----------------
// Always hides after 2s even if API fails.
async function runPreloader(minMs = 2000) {
  let p = 0;
  el.loaderHint.textContent = "Starting…";

  const timer = setInterval(() => {
    p = Math.min(95, p + (p < 60 ? 7 : 3));
    el.progressBar.style.width = p + "%";
  }, 120);

  await new Promise((r) => setTimeout(r, minMs));

  clearInterval(timer);
  el.progressBar.style.width = "100%";
  el.loaderHint.textContent = "Done";

  await new Promise((r) => setTimeout(r, 120));
  el.preloader.style.display = "none";
}

// ---------------- State ----------------
let region = "np";         // "np" for Nepal, "" for World (no filter)
let category = "top";      // chip category
let currentQuery = "Nepal";// default query
let page = 1;              // for "Load more"

// ---------------- Helpers ----------------
const cut = (t, n) => (t && t.length > n ? t.slice(0, n) + "…" : (t || ""));
const setStatus = (t) => (el.status.textContent = t || "");

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function placeholderCard() {
  return {
    title: "More updates soon",
    description: "Fresh news will appear here when available.",
    image: "https://placehold.co/800x500?text=SAMACHAR",
    url: "",
    source: { name: "SAMACHAR" },
    publishedAt: new Date().toISOString()
  };
}

function renderCards(articles, append = false) {
  if (!append) el.blog.innerHTML = "";

  // Render real articles
  articles.forEach((a) => {
    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    img.src = a.image || "https://placehold.co/800x500?text=SAMACHAR";
    img.alt = a.title || "News image";
    img.onerror = () => {
      img.onerror = null;
      img.src = "https://placehold.co/800x500?text=SAMACHAR";
    };

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = cut(a.title || "Untitled", 80);

    const desc = document.createElement("div");
    desc.className = "card-desc";
    desc.textContent = cut(a.description || "No description available.", 140);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const source = a.source && a.source.name ? a.source.name : "Unknown";
    meta.innerHTML = `<span>${cut(source, 18)}</span><span>${timeAgo(a.publishedAt)}</span>`;

    body.appendChild(title);
    body.appendChild(desc);
    body.appendChild(meta);

    card.appendChild(img);
    card.appendChild(body);

    if (a.url) {
      card.addEventListener("click", () => window.open(a.url, "_blank"));
    } else {
      card.classList.add("placeholder");
    }

    el.blog.appendChild(card);
  });
}

function fillToMultipleOf16(articles) {
  // Ensure the grid always looks complete for the first screen.
  const list = articles.slice();
  while (list.length < TARGET_COUNT) list.push(placeholderCard());
  return list.slice(0, TARGET_COUNT);
}

// ---------------- API ----------------
// We use GNews "search" for everything; categories are simulated by changing the query.
// Page is supported by GNews. If page doesn't work on your plan, it still shows first 16.
function categoryToQuery(cat) {
  if (cat === "top") return region === "np" ? "Nepal" : "World";
  if (cat === "politics") return region === "np" ? "Nepal politics" : "politics";
  if (cat === "sports") return region === "np" ? "Nepal sports" : "sports";
  if (cat === "technology") return region === "np" ? "Nepal technology" : "technology";
  if (cat === "business") return region === "np" ? "Nepal business" : "business";
  return region === "np" ? "Nepal" : "World";
}

async function fetchNews({ q, append = false } = {}) {
  const query = (q || currentQuery).trim() || (region === "np" ? "Nepal" : "World");
  currentQuery = query;

  const url =
    `https://gnews.io/api/v4/search` +
    `?q=${encodeURIComponent(query)}` +
    `&lang=en` +
    (region ? `&country=${region}` : "") +
    `&max=${TARGET_COUNT}` +
    `&page=${page}` +
    `&apikey=${GNEWS_KEY}`;

  try {
    setStatus(append ? "Loading more…" : "Loading news…");
    const res = await fetch(url);
    const data = await res.json();

    const articles = Array.isArray(data.articles) ? data.articles : [];

    if (!articles.length && !append) {
      setStatus("No live news returned — showing placeholders (4×4). Try searching.");
      renderCards(fillToMultipleOf16([]), false);
      return;
    }

    setStatus("");

    if (!append) {
      // first load: always show 16 cards even if fewer returned
      renderCards(fillToMultipleOf16(articles), false);
    } else {
      // load more: append real ones (no placeholders)
      renderCards(articles, true);
    }
  } catch (e) {
    console.error(e);
    if (!append) {
      setStatus("API error / quota reached — showing placeholders (4×4).");
      renderCards(fillToMultipleOf16([]), false);
    } else {
      setStatus("API error / quota reached — could not load more.");
    }
  }
}

// ---------------- UI wiring ----------------
function setRegion(next) {
  region = next;
  el.btnNepal.classList.toggle("active", region === "np");
  el.btnWorld.classList.toggle("active", region !== "np");
  page = 1;
  currentQuery = categoryToQuery(category);
  fetchNews({ q: currentQuery });
}

function setCategory(nextCat) {
  category = nextCat;
  el.chips.forEach(ch => ch.classList.toggle("active", ch.dataset.cat === category));
  page = 1;
  currentQuery = categoryToQuery(category);
  fetchNews({ q: currentQuery });
}

el.btnNepal.addEventListener("click", () => setRegion("np"));
el.btnWorld.addEventListener("click", () => setRegion(""));

el.chips.forEach(chip => {
  chip.addEventListener("click", () => setCategory(chip.dataset.cat));
});

el.searchBtn.addEventListener("click", () => {
  const q = el.searchInput.value.trim();
  if (!q) return setStatus("Type something to search (example: Nepal, cricket, politics).");
  page = 1;
  // Search overrides category query
  fetchNews({ q });
});

el.searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") el.searchBtn.click();
});

el.loadMore.addEventListener("click", async () => {
  page += 1;
  await fetchNews({ q: currentQuery, append: true });
});

// ---------------- Init ----------------
(async function init() {
  // Start preloader and fetch in parallel; preloader always ends after 2s.
  const loader = runPreloader(2000);

  setRegion("np");          // sets active buttons + fetches
  setCategory("top");       // ensures chips UI

  await loader;
})();
