import { fetchLinks } from "./data-source.js";
const state = { links: [], query: "", category: "all", audience: "all", sort: "order" };
const $ = id => document.getElementById(id);
const safeUrl = value => { try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : ""; } catch { return ""; } };
function button(text, active, action) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip" + (active ? " active" : "");
  b.textContent = text; b.setAttribute("aria-pressed", String(active)); b.onclick = action;
  return b;
}
function renderFilters() {
  $("category-filters").replaceChildren(...["all", ...new Set(state.links.map(x => x.category).filter(Boolean))].map(c => button(c === "all" ? "すべて" : c, state.category === c, () => { state.category = c; renderFilters(); render(); })));
  const labels = { all: "すべて", common: "共通", self: "自分", family: "家族" };
  $("audience-filters").replaceChildren(...Object.keys(labels).map(a => button(labels[a], state.audience === a, () => { state.audience = a; renderFilters(); render(); })));
}
function order(x) { return x.order.trim() !== "" && Number.isFinite(Number(x.order)) ? Number(x.order) : 9999; }
function render() {
  const links = state.links.filter(x => x.name.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()) && (state.category === "all" || x.category === state.category) && (state.audience === "all" || (x.audience || "common").split(/[,、]/).map(v => v.trim()).includes(state.audience)));
  links.sort((a,b) => state.sort === "name" ? a.name.localeCompare(b.name,"ja") : state.sort === "category" ? a.category.localeCompare(b.category,"ja") || order(a)-order(b) : order(a)-order(b));
  $("result-count").textContent = links.length + "件";
  $("link-grid").replaceChildren(...links.map(x => {
    const a = document.createElement("a"); a.className = "link-card"; a.href = x.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    const fallback = document.createElement("span"); fallback.className = "favicon fallback"; fallback.textContent = Array.from(x.name)[0] || "F"; fallback.setAttribute("aria-hidden","true");
    const img = document.createElement("img"); img.className = "favicon"; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
    const auto = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(new URL(x.url).hostname) + "&sz=128";
    img.src = safeUrl(x.icon_url) || auto;
    img.onerror = () => { if (img.src !== auto) { img.src = auto; } else { img.replaceWith(fallback); } };
    const name = document.createElement("span"); name.className = "link-name"; name.textContent = x.name;
    const meta = document.createElement("span"); meta.className = "link-meta"; meta.textContent = x.category;
    a.append(img,name,meta); return a;
  }));
  if (!links.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "条件に合うリンクがありません"; $("link-grid").append(p); }
}
async function init() {
  try {
    state.links = (await fetchLinks()).filter(x => safeUrl(x.url)).map(x => ({...x,url:safeUrl(x.url)}));
    $("data-status").textContent = "最終取得: " + new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});
    renderFilters(); render();
  } catch (e) { $("data-status").textContent = "データを読み込めませんでした。再読み込みしてください。"; console.error(e); }
}
$("search").setAttribute("aria-label","サイト名を検索");
$("search").addEventListener("input", e => { state.query = e.target.value.trim(); render(); });
$("sort").addEventListener("change", e => { state.sort = e.target.value; render(); });
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const themeButton = $("theme-toggle");
const root = document.documentElement;
const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : systemTheme.matches;
function syncThemeButton() {
  const dark = isDark();
  themeButton.textContent = dark ? "☀" : "☾";
  themeButton.setAttribute("aria-label", dark ? "ライトモードに切り替え" : "ダークモードに切り替え");
}
themeButton.addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  syncThemeButton();
});
systemTheme.addEventListener("change", syncThemeButton);
syncThemeButton();
init();
