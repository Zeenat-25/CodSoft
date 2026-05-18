const state = {
  category: "all",
  tags: [],
  minRating: 7.0,
  search: "",
  saved: JSON.parse(localStorage.getItem("zeenatrix_saved") || "[]"),
  liked: JSON.parse(localStorage.getItem("zeenatrix_liked") || "[]"),
  disliked: JSON.parse(localStorage.getItem("zeenatrix_disliked") || "[]")
};

const TAG_MAP = {
  all:      ["action","sci-fi","drama","thriller","adventure","comedy","romance","mystery","fantasy","history","non-fiction","technology","gaming","premium","self-help","psychology","space","classic"],
  movies:   ["action","sci-fi","drama","thriller","adventure","comedy","mystery","fantasy","history","mind-bending","space","epic","neo-noir","social","biography","music","post-apocalyptic"],
  books:    ["sci-fi","fantasy","adventure","self-help","psychology","non-fiction","history","mystery","philosophy","biography","technology","programming","classic","romance","science","gaming"],
  products: ["technology","gaming","premium","productivity","audio","wireless","portable","display","home","creative","wellness","photography","performance","laptop","reading"]
};

const grid       = document.getElementById("rec-grid");
const recsCount  = document.getElementById("recs-count");
const savedList  = document.getElementById("saved-list");
const savedCount = document.getElementById("saved-count");
const toastEl    = document.getElementById("toast");
const tagGrid    = document.getElementById("tag-grid");
const ratingSlider  = document.getElementById("min-rating");
const ratingDisplay = document.getElementById("rating-display");
const searchInput   = document.getElementById("search-input");
const modalOverlay  = document.getElementById("modal-overlay");

window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("loader").classList.add("hidden");
  }, 2400);
});

function toggleNav() {
  const links = document.getElementById("nav-links");
  const burger = document.getElementById("hamburger");
  links.classList.toggle("open");
  burger.classList.toggle("open");
}

function scrollToTop(e) {
  e && e.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function activateApp() {
  document.getElementById("app").scrollIntoView({ behavior: "smooth" });
}

document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.category = btn.dataset.cat;
    state.tags = [];
    renderTags();
    renderCards();
  });
});

function renderTags() {
  const tags = TAG_MAP[state.category] || TAG_MAP.all;
  tagGrid.innerHTML = tags.map(tag => `
    <button class="tag-chip${state.tags.includes(tag) ? " active" : ""}" data-tag="${tag}">
      ${tag}
    </button>
  `).join("");

  tagGrid.querySelectorAll(".tag-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const tag = chip.dataset.tag;
      if (state.tags.includes(tag)) {
        state.tags = state.tags.filter(t => t !== tag);
        chip.classList.remove("active");
      } else {
        state.tags.push(tag);
        chip.classList.add("active");
      }
      renderCards();
    });
  });
}

ratingSlider.addEventListener("input", () => {
  state.minRating = parseFloat(ratingSlider.value);
  ratingDisplay.textContent = state.minRating.toFixed(1);
  renderCards();
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  renderCards();
});

function scoreItem(item) {
  let score = 0;
  const totalTags = state.tags.length;

  
  if (state.category !== "all" && item.category !== state.category) return -1;

  
  if (totalTags > 0) {
    const matches = item.tags.filter(t => state.tags.includes(t)).length;
    if (matches === 0) return -1;
    score += (matches / totalTags) * 70;
  } else {
    score += 40; 
  }

  
  score += ((item.rating - 7) / 2.2) * 20;

  
  if (state.liked.includes(item.id))    score += 12;
  if (state.disliked.includes(item.id)) score -= 25;

  return Math.min(Math.max(score, 0), 100);
}

function getRecommendations() {
  let items = DATA.filter(item => item.rating >= state.minRating);

  
  if (state.search) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(state.search) ||
      item.description.toLowerCase().includes(state.search) ||
      item.tags.some(t => t.includes(state.search))
    );
  }

  
  const scored = items
    .map(item => ({ ...item, _score: scoreItem(item) }))
    .filter(item => item._score >= 0);

  
  scored.sort((a, b) => b._score - a._score);

  return scored.slice(0, 12);
}

function renderCards() {
  
  grid.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner-ring"></div>
      PROCESSING NEURAL MATRIX...
    </div>`;

  setTimeout(() => {
    const items = getRecommendations();
    recsCount.textContent = `${items.length} PICKS`;

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⬡</div>
          <p class="empty-title">NO SIGNALS DETECTED</p>
          <p class="empty-desc">Adjust your Taste Profile or try different filters to find matches.</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map((item, i) => buildCard(item, i)).join("");

    
    grid.querySelectorAll(".btn-action.btn-like").forEach(btn => {
      btn.addEventListener("click", () => handleLike(btn.dataset.id));
    });
    grid.querySelectorAll(".btn-action.btn-dislike").forEach(btn => {
      btn.addEventListener("click", () => handleDislike(btn.dataset.id));
    });
    grid.querySelectorAll(".btn-action.btn-save").forEach(btn => {
      btn.addEventListener("click", () => handleSave(btn.dataset.id));
    });

    
    setTimeout(() => {
      grid.querySelectorAll(".match-bar-fill").forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    }, 100);

  }, 420);
}

function buildCard(item, idx) {
  const isSaved   = state.saved.includes(item.id);
  const matchPct  = Math.round(Math.min(item._score, 100));
  const badgeClass = `badge-${item.category}`;

  return `
    <div class="rec-card" style="animation-delay:${idx * 0.06}s">
      <div class="card-img-wrap">
        <img src="${item.image}" alt="${item.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=240&fit=crop'">
        <div class="card-img-overlay"></div>
        <span class="card-cat-badge ${badgeClass}">${item.category}</span>
        <span class="card-rating">★ ${item.rating.toFixed(1)}</span>
      </div>
      <div class="card-body">
        <div class="card-tags">
          ${item.tags.slice(0, 3).map(t => `<span class="card-tag">${t}</span>`).join("")}
        </div>
        <h3 class="card-title">${item.title}</h3>
        <p class="card-desc">${item.description}</p>
        <div class="card-match">
          <span class="match-label">MATCH</span>
          <div class="match-bar-bg">
            <div class="match-bar-fill" style="width:0%" data-width="${matchPct}%"></div>
          </div>
          <span class="match-pct">${matchPct}%</span>
        </div>
        <div class="card-actions">
          <button class="btn-action btn-like" data-id="${item.id}" title="Like" aria-label="Like ${item.title}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
            </svg>
          </button>
          <button class="btn-action btn-dislike" data-id="${item.id}" title="Dislike" aria-label="Dislike ${item.title}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
              <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
            </svg>
          </button>
          <button class="btn-action btn-save${isSaved ? " saved" : ""}" data-id="${item.id}" title="${isSaved ? "Unsave" : "Save"}" aria-label="${isSaved ? "Remove from" : "Add to"} Saved Universe">
            <svg viewBox="0 0 24 24" fill="${isSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
}

function handleLike(id) {
  if (state.liked.includes(id)) {
    state.liked = state.liked.filter(i => i !== id);
    showToast("LIKE REMOVED");
  } else {
    state.liked.push(id);
    state.disliked = state.disliked.filter(i => i !== id);
    showToast("SIGNAL BOOST APPLIED ↑");
  }
  localStorage.setItem("zeenatrix_liked", JSON.stringify(state.liked));
  renderCards();
}

function handleDislike(id) {
  if (state.disliked.includes(id)) {
    state.disliked = state.disliked.filter(i => i !== id);
    showToast("SIGNAL RESTORED");
  } else {
    state.disliked.push(id);
    state.liked = state.liked.filter(i => i !== id);
    showToast("SIGNAL SUPPRESSED ↓");
  }
  localStorage.setItem("zeenatrix_disliked", JSON.stringify(state.disliked));
  renderCards();
}

function handleSave(id) {
  if (state.saved.includes(id)) {
    state.saved = state.saved.filter(i => i !== id);
    showToast("REMOVED FROM UNIVERSE");
  } else {
    state.saved.push(id);
    showToast("ADDED TO SAVED UNIVERSE ✦");
  }
  localStorage.setItem("zeenatrix_saved", JSON.stringify(state.saved));
  updateSavedCount();
  
  const btn = grid.querySelector(`.btn-save[data-id="${id}"]`);
  if (btn) {
    const isSaved = state.saved.includes(id);
    btn.classList.toggle("saved", isSaved);
    btn.querySelector("svg").setAttribute("fill", isSaved ? "currentColor" : "none");
  }
}

function updateSavedCount() {
  savedCount.textContent = state.saved.length;
}

function openSavedModal() {
  const items = DATA.filter(d => state.saved.includes(d.id));
  if (items.length === 0) {
    savedList.innerHTML = `
      <div style="text-align:center; padding: 40px 0; color: var(--text-muted); font-family:'Share Tech Mono',monospace; font-size:13px; letter-spacing:2px;">
        UNIVERSE IS EMPTY<br>
        <span style="font-size:11px; opacity:.6; display:block; margin-top:8px;">Save items from Zeenatrix Picks</span>
      </div>`;
  } else {
    savedList.innerHTML = items.map(item => `
      <div class="saved-item">
        <img class="saved-item-img" src="${item.image}" alt="${item.title}" loading="lazy">
        <div class="saved-item-info">
          <div class="saved-item-title">${item.title}</div>
          <div class="saved-item-cat">${item.category} · ★ ${item.rating.toFixed(1)}</div>
        </div>
        <button class="btn-unsave" data-id="${item.id}" onclick="unsaveFromModal('${item.id}')">REMOVE</button>
      </div>`).join("");
  }
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSavedModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

function unsaveFromModal(id) {
  state.saved = state.saved.filter(i => i !== id);
  localStorage.setItem("zeenatrix_saved", JSON.stringify(state.saved));
  updateSavedCount();
  showToast("REMOVED FROM UNIVERSE");
  openSavedModal(); 

  
  const btn = grid.querySelector(`.btn-save[data-id="${id}"]`);
  if (btn) {
    btn.classList.remove("saved");
    btn.querySelector("svg").setAttribute("fill", "none");
  }
}

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeSavedModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSavedModal();
});

let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function init() {
  renderTags();
  renderCards();
  updateSavedCount();
  ratingDisplay.textContent = state.minRating.toFixed(1);
}

init();