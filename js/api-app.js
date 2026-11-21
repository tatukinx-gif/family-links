import { fetchConfiguration } from "./api-config.js";
import { createFamilyLinksClient } from "./api-client.js";
const api = createFamilyLinksClient("https://script.google.com/macros/s/AKfycbyUwNVnQ0fL-df3Iex9MG5uPFpw4orgM_Py4ZofrPLg7aqpcROzbgytbo1rmObldRHmOw/exec");
const state = { links: [], query: "", category: "all", audience: "all", sort: "order" };
const $ = id => document.getElementById(id);
const safeUrl = value => { try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : ""; } catch { return ""; } };
function button(text, active, action) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip" + (active ? " active" : "");
  b.textContent = text; b.setAttribute("aria-pressed", String(active)); b.onclick = action;
  return b;
}
let categories = [];
let currentAudience = null;
const categoryKey = link => link.category_id;
const categoryName = link => categories.find(category => category.id === link.category_id)?.name ?? "";
const options = rows => {
  if (!rows) return null;
  const seen = new Set(["all"]);
  return rows.filter(x => x.id && x.name && !seen.has(x.id) && seen.add(x.id))
    .sort((a,b) => order(a)-order(b))
    .map(x => ({...x, enabled: /^(true|1|yes)$/i.test(x.enabled)}));
};
function eligible(x) {
  const category = categories?.find(c => c.id === categoryKey(x));
  return category?.enabled === true;
}
function renderFilters() {
  const categoryOptions = categories.filter(category => category.enabled);
  for (const [element,key,rows] of [
    ["category-filters","category",categoryOptions],
    ["audience-filters","audience",currentAudience ? [{id:"common",name:"共通"},{id:"mine",name:currentAudience.name}] : []]
  ]) {
    $(element).replaceChildren(...[{id:"all",name:key === "audience" && currentAudience ? "すべて（共通＋本人）" : key === "audience" ? "共通" : "すべて"},...rows].map(x =>
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
function order(x) { const value = String(x.order ?? "").trim(); return value && Number.isFinite(Number(value)) ? Number(value) : 9999; }
function matchesAudience(link, selected) {
  return selected === "all" || (selected === "common" ? link.common : !link.common);
}
function render() {
  const links = state.links.filter(x => eligible(x) && x.name.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()) && (state.category === "all" || categoryKey(x) === state.category) && matchesAudience(x, state.audience));
  links.sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name, "ja");
    if (state.sort === "category") {
      const categoryOrder = order(categories.find(c => c.id === a.category_id) ?? {}) -
        order(categories.find(c => c.id === b.category_id) ?? {});
      if (categoryOrder) return categoryOrder;
    }
    return order(a) - order(b);
  });
  $("result-count").textContent = links.length + "件";
  $("link-grid").replaceChildren(...links.map(x => {
    const a = document.createElement("a"); a.className = "link-card"; a.href = x.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = x.name;
    const fallback = document.createElement("span"); fallback.className = "favicon fallback"; fallback.textContent = Array.from(x.name)[0] || "F"; fallback.setAttribute("aria-hidden","true");
    const img = document.createElement("img"); img.className = "favicon"; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
    const auto = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(new URL(x.url).hostname) + "&sz=128";
    img.src = safeUrl(x.icon_url) || auto;
    img.onerror = () => { if (img.src !== auto) { img.src = auto; } else { img.replaceWith(fallback); } };
    const name = document.createElement("span"); name.className = "link-name"; name.textContent = x.name;
    a.append(img,name);
    if (!x.can_hide) return a;
    const tile = document.createElement("div"); tile.className = "managed-tile";
    const hide = button("×", false, () => ask(x.name + "を非表示にしますか？", null, "はい", async () => {
      await api.hide(x.link_id);
      state.links = state.links.filter(link => link.link_id !== x.link_id);
      render();
    }));
    hide.removeAttribute("aria-pressed");
    hide.className = "hide-link";
    hide.setAttribute("aria-label", x.name + "を非表示にする");
    tile.append(a, hide);
    return tile;
  }));
  if (!links.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "条件に合うリンクがありません"; $("link-grid").append(p); }
}
const registration = $("registration");
const registrationMessage = $("registration-status");
const registerButton = $("register-device");
const refreshButton = $("refresh-device");
function ask(title, field, acceptLabel, action) {
  const dialog = document.createElement("dialog");
  const heading = document.createElement("h2"); heading.id = "dialog-heading"; heading.textContent = title;
  dialog.setAttribute("aria-labelledby", heading.id);
  const error = document.createElement("p"); error.setAttribute("role","alert");
  const cancel = button("いいえ", false, () => dialog.close());
  const accept = button(acceptLabel, false, async () => {
    accept.disabled = cancel.disabled = true;
    error.textContent = "";
    try { await action(); dialog.close(); }
    catch (e) { error.textContent = e.message || "通信できませんでした。"; }
    finally { accept.disabled = cancel.disabled = false; }
  });
  cancel.removeAttribute("aria-pressed"); accept.removeAttribute("aria-pressed");
  dialog.addEventListener("cancel", e => { if (accept.disabled) e.preventDefault(); });
  dialog.addEventListener("close", () => dialog.remove(), {once:true});
  dialog.append(heading, ...(field ? [field] : []), error, cancel, accept);
  document.body.append(dialog); dialog.showModal();
}
registerButton.onclick = () => {
  const name = document.createElement("input"); name.maxLength = 60; name.autocomplete = "name";
  const label = document.createElement("label"); label.append("お名前 ", name);
  ask("利用者登録", label, "登録申請", async () => {
    if (!name.value.trim()) throw Error("お名前を入力してください。");
    await api.register(name.value.trim());
    await refresh();
  });
};
async function refresh() {
  refreshButton.disabled = true;
  try {
    const data = await api.list();
    if (!Array.isArray(data.categories)) throw new Error("カテゴリー情報を取得できませんでした");
    categories = options(data.categories) ?? [];
    if (state.category !== "all" && !categories.some(c => c.id === state.category && c.enabled)) {
      state.category = "all";
    }
    if (currentAudience?.id !== data.audience?.id) state.audience = "all";
    currentAudience = data.audience;
    state.links = data.links.filter(x => safeUrl(x.url) &&
      (x.common === true || Boolean(currentAudience)))
      .map(x => ({...x, url:safeUrl(x.url), can_hide: !x.common && x.can_hide}));
    const pending = data.status === "pending";
    registration.hidden = Boolean(currentAudience);
    registerButton.hidden = data.status !== "unregistered";
    refreshButton.hidden = !pending;
    registrationMessage.textContent = pending ? "管理者の承認待ち" : "";
  } catch {
    currentAudience = null;
    categories = [];
    state.links = [];
    state.audience = "all";
    registerButton.hidden = true;
    registration.hidden = false;
    refreshButton.hidden = false;
    registrationMessage.textContent = "リンクを取得できませんでした。「状態を更新」で再試行してください。";
  } finally { refreshButton.disabled = false; renderFilters(); render(); }
}
refreshButton.onclick = refresh;
async function init() {
  const config = fetchConfiguration().then(config => {
    applySettings(config.settings);
    renderFilters(); render();
  });
  await Promise.all([refresh(), config]);
}
$("search").setAttribute("aria-label","サイト名を検索");
$("search").addEventListener("input", e => { state.query = e.target.value.trim(); render(); });
$("sort").addEventListener("change", e => { state.sort = e.target.value; render(); });
const filterDetails = $("filter-details");
document.addEventListener("pointerdown", event => {
  if (filterDetails?.open && !event.composedPath().includes(filterDetails)) {
    filterDetails.open = false;
  }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && filterDetails?.open) {
    event.preventDefault();
    filterDetails.open = false;
    filterDetails.querySelector("summary").focus({preventScroll:true});
  }
});
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
