import { fetchLinks, fetchConfiguration } from "./data-source.js?v=sheet-settings-1";
const state = { links: [], query: "", category: "all", audience: "all", sort: "order" };
const $ = id => document.getElementById(id);
const safeUrl = value => { try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : ""; } catch { return ""; } };
function button(text, active, action) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip" + (active ? " active" : "");
  b.textContent = text; b.setAttribute("aria-pressed", String(active)); b.onclick = action;
  return b;
}
let categories = null;
const storedCategoryName = x => x.category_name || x.category || "";
let audiences = null;
const categoryKey = x => categories ? x.category_id || categories.find(c => c.name === storedCategoryName(x))?.id || storedCategoryName(x) : storedCategoryName(x);
const categoryName = x => categories?.find(c => c.id === categoryKey(x))?.name ?? storedCategoryName(x);
const audienceKeys = x => ((Object.hasOwn(x, "audience_id") ? x.audience_id : x.audience) || "common").split(/[,、]/).map(v => v.trim());
const options = rows => {
  if (!rows) return null;
  const seen = new Set(["all"]);
  return rows.filter(x => x.id && x.name && !seen.has(x.id) && seen.add(x.id))
    .sort((a,b) => order(a)-order(b))
    .map(x => ({...x, enabled: /^(true|1|yes)$/i.test(x.enabled)}));
};
function eligible(x) {
  const category = categories?.find(c => c.id === categoryKey(x));
  return category?.enabled !== false;
}
function renderFilters() {
  const categoryOptions = categories?.filter(x=>x.enabled) ??
    [...new Set(state.links.map(storedCategoryName).filter(Boolean))].map(name=>({id:name,name}));
  for (const [element,key,rows] of [
    ["category-filters","category",categoryOptions],
    ["audience-filters","audience",audiences?.filter(x=>x.enabled && x.id !== "common") ?? []]
  ]) {
    $(element).replaceChildren(...[{id:"all",name:"すべて"},...rows].map(x =>
      button(x.name,state[key]===x.id,()=>{state[key]=x.id;renderFilters();render();})));
  }
}
function applySettings(rows) {
  const settings = new Map((rows ?? []).map(x=>[x.key,x.value]));
  const title = settings.get("site_title");
  if (title) { document.title = title; document.querySelector(".eyebrow").textContent = title; }
  if (settings.has("site_subtitle")) document.querySelector(".topbar h1").textContent = settings.get("site_subtitle");
  const bar = document.querySelector(".topbar");
  const bg = settings.get("header_color");
  const fg = settings.get("header_text_color");
  const validColor = value => /^#[0-9a-f]{6}$/i.test(value ?? "");
  if (validColor(bg)) {
    bar.style.backgroundColor = bg;
    document.querySelector('meta[name="theme-color"]').content = bg;
  }
  if (validColor(fg)) {
    for (const el of [bar,bar.querySelector(".eyebrow"),$("theme-toggle")]) el.style.color = fg;
  }
}
function order(x) { return x.order.trim() !== "" && Number.isFinite(Number(x.order)) ? Number(x.order) : 9999; }
function matchesAudience(link, selected) {
  const ids = audienceKeys(link);
  return selected === "all" || ids.includes("common") || ids.includes(selected);
}
function render() {
  const links = state.links.filter(x => eligible(x) && x.name.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()) && (state.category === "all" || categoryKey(x) === state.category) && matchesAudience(x, state.audience));
  links.sort((a,b) => state.sort === "name" ? a.name.localeCompare(b.name,"ja") : state.sort === "category" ? (categories ? order(categories.find(c=>c.id===categoryKey(a)) ?? {order:""}) - order(categories.find(c=>c.id===categoryKey(b)) ?? {order:""}) : categoryName(a).localeCompare(categoryName(b),"ja")) || order(a)-order(b) : order(a)-order(b));
  $("result-count").textContent = links.length + "件";
  $("link-grid").replaceChildren(...links.map(x => {
    const a = document.createElement("a"); a.className = "link-card"; a.href = x.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = x.name;
    const fallback = document.createElement("span"); fallback.className = "favicon fallback"; fallback.textContent = Array.from(x.name)[0] || "F"; fallback.setAttribute("aria-hidden","true");
    const img = document.createElement("img"); img.className = "favicon"; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
    const auto = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(new URL(x.url).hostname) + "&sz=128";
    img.src = safeUrl(x.icon_url) || auto;
    img.onerror = () => { if (img.src !== auto) { img.src = auto; } else { img.replaceWith(fallback); } };
    const name = document.createElement("span"); name.className = "link-name"; name.textContent = x.name;
    a.append(img,name); return a;
  }));
  if (!links.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "条件に合うリンクがありません"; $("link-grid").append(p); }
}
async function init() {
  try {
    const [links, config] = await Promise.all([fetchLinks(), fetchConfiguration()]);
    categories = options(config.categories); audiences = options(config.audiences);
    applySettings(config.settings);
    state.links = links.filter(x => safeUrl(x.url)).map(x => ({...x,url:safeUrl(x.url)}));
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
