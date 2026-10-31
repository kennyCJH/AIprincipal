/**
 * ============================================================================
 * 【閒閒罔飛ㄟ所在】核心互動與「隨時更新」視覺化管理系統 (app.js)
 * ============================================================================
 */

const STORAGE_KEY = "AI_PRINCIPAL_SITE_DATA_V1";

// 應用程式狀態
const state = {
  data: null,
  activeCategory: "all",
  searchQuery: "",
  onlyRealOrFeatured: false,
  adminMode: false,
  editingToolId: null,
  cmsActiveTab: "tools-list" // 'tools-list' | 'tool-form' | 'categories' | 'site-info' | 'sync'
};

// 初始化載入資料
function initData() {
  const defaultData = window.SITE_DATA;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.tools) && Array.isArray(parsed.categories)) {
        state.data = parsed;
        return;
      }
    }
  } catch (e) {
    console.warn("讀取本機暫存資料失敗，使用預設 tools-data.js 資料：", e);
  }
  state.data = JSON.parse(JSON.stringify(defaultData));
}

// 儲存變更至 LocalStorage 並重新渲染
function saveDataToLocal(toastMsg = "✅ 已即時更新並儲存至瀏覽器！") {
  state.data.lastUpdated = new Date().toISOString().slice(0, 10);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch (e) {
    console.error("儲存 LocalStorage 失敗：", e);
  }
  renderAll();
  if (toastMsg) showToast(toastMsg);
}

// 產生匯出用的 tools-data.js 完整檔案內容
function generateToolsDataJsContent() {
  const jsonString = JSON.stringify(state.data, null, 2);
  return `/**
 * ============================================================================
 * 【${state.data.siteInfo.title}】網站資料庫設定檔 (tools-data.js)
 * 最後更新日期：${state.data.lastUpdated}
 * ============================================================================
 * 此檔案由網站內建「⚙️ 隨時更新管理工坊」自動生成。
 */

window.SITE_DATA = ${jsonString};
`;
}

// 直接寫入硬碟上的 tools-data.js (支援 Chrome / Edge File System Access API)
async function saveToToolsDataFile() {
  const content = generateToolsDataJsContent();

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "tools-data.js",
        types: [
          {
            description: "JavaScript 網站資料檔 (tools-data.js)",
            accept: { "text/javascript": [".js"] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      showToast("🎉 已直接將最新內容寫入 tools-data.js 檔案！");
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn("File System API 寫入中斷，改用下載方式：", err);
    }
  }

  // 降級方案：直接觸發瀏覽器下載 tools-data.js
  downloadToolsDataFile();
}

function downloadToolsDataFile() {
  const content = generateToolsDataJsContent();
  const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tools-data.js";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("📥 已下載最新 tools-data.js，請覆蓋網站資料夾中的同名檔案即可永久生效！");
}

// ============================================================================
// 畫面渲染邏輯
// ============================================================================

function renderAll() {
  renderSiteHeaderAndHero();
  renderCategoryTabs();
  renderToolsGrid();
}

function renderSiteHeaderAndHero() {
  const info = state.data.siteInfo;
  document.title = `${info.title}｜${info.subtitle}`;

  const elBrandTitle = document.getElementById("brandTitle");
  const elBrandSub = document.getElementById("brandSubtitle");
  const elHeroBadge = document.getElementById("heroBadge");
  const elHeroTitle = document.getElementById("heroTitle");
  const elHeroQuote = document.getElementById("heroQuote");
  const elHeroDesc = document.getElementById("heroDesc");
  const elPrincipalName = document.getElementById("principalName");
  const elPrincipalRole = document.getElementById("principalRole");
  const elPrincipalBio = document.getElementById("principalBio");

  if (elBrandTitle) elBrandTitle.textContent = info.title;
  if (elBrandSub) elBrandSub.textContent = info.subtitle;
  if (elHeroBadge) elHeroBadge.textContent = info.badgeText;
  if (elHeroTitle) {
    elHeroTitle.innerHTML = `<span class="hero-title-highlight">${escapeHtml(info.title)}</span>`;
  }
  if (elHeroQuote) elHeroQuote.textContent = info.heroQuote;
  if (elHeroDesc) elHeroDesc.textContent = info.heroDescription;
  if (elPrincipalName) elPrincipalName.textContent = info.principalName;
  if (elPrincipalRole) elPrincipalRole.textContent = info.principalTitle;
  if (elPrincipalBio) elPrincipalBio.textContent = info.principalBio;

  // 更新統計數字
  const totalTools = state.data.tools.length;
  const totalCats = state.data.categories.length;
  const totalLinksAndFiles = state.data.tools.reduce(
    (acc, t) => acc + (t.links ? t.links.length : 0) + (t.downloads ? t.downloads.length : 0),
    0
  );

  const statTools = document.getElementById("statTotalTools");
  const statCats = document.getElementById("statTotalCats");
  const statRes = document.getElementById("statTotalResources");
  if (statTools) statTools.textContent = totalTools;
  if (statCats) statCats.textContent = totalCats;
  if (statRes) statRes.textContent = totalLinksAndFiles;
}

function renderCategoryTabs() {
  const container = document.getElementById("categoryTabs");
  const banner = document.getElementById("categoryBanner");
  if (!container) return;

  const tools = state.data.tools;
  const allCount = tools.length;

  let html = `
    <button class="cat-tab ${state.activeCategory === "all" ? "active" : ""}" onclick="setCategory('all')">
      <span>✨ 全部工具</span>
      <span class="cat-count">${allCount}</span>
    </button>
  `;

  state.data.categories.forEach((cat) => {
    const count = tools.filter((t) => t.category === cat.id).length;
    const isActive = state.activeCategory === cat.id ? "active" : "";
    html += `
      <button class="cat-tab ${isActive}" onclick="setCategory('${escapeAttr(cat.id)}')">
        <span>${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</span>
        <span class="cat-count">${count}</span>
      </button>
    `;
  });

  container.innerHTML = html;

  // 分類描述列
  if (banner) {
    if (state.activeCategory === "all") {
      banner.innerHTML = `
        <span>🧭 <strong>目前顯示：全部領域工具</strong> — 點擊上方分類標籤可切換「教學與課程創新」、「校務行政賦能」等不同面向，或點選卡片查看完整步驟與檔案下載。</span>
        <span style="white-space:nowrap;">最後更新：${escapeHtml(state.data.lastUpdated || "今日")}</span>
      `;
    } else {
      const catObj = state.data.categories.find((c) => c.id === state.activeCategory);
      if (catObj) {
        banner.innerHTML = `
          <span>${escapeHtml(catObj.icon)} <strong>${escapeHtml(catObj.name)}：</strong>${escapeHtml(catObj.description)}</span>
          <button class="btn btn-ghost" style="padding:0.2rem 0.65rem;font-size:0.8rem;" onclick="setCategory('all')">返回全部</button>
        `;
      }
    }
  }
}

function getFilteredTools() {
  const q = state.searchQuery.trim().toLowerCase();
  return state.data.tools.filter((tool) => {
    const matchCat = state.activeCategory === "all" || tool.category === state.activeCategory;
    if (!matchCat) return false;

    if (!q) return true;
    const inTitle = (tool.title || "").toLowerCase().includes(q);
    const inSummary = (tool.summary || "").toLowerCase().includes(q);
    const inTags = (tool.tags || []).some((tag) => tag.toLowerCase().includes(q));
    const inTech = (tool.techStack || "").toLowerCase().includes(q);
    const inPrompt = (tool.promptText || "").toLowerCase().includes(q);
    return inTitle || inSummary || inTags || inTech || inPrompt;
  });
}

function renderToolsGrid() {
  const grid = document.getElementById("toolsGrid");
  if (!grid) return;

  const filtered = getFilteredTools();

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1.5rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-strong);">
        <div style="font-size: 2.8rem; margin-bottom: 0.75rem;">🔍</div>
        <h3 style="font-family: var(--font-serif); font-size: 1.3rem; margin-bottom: 0.4rem;">找不到符合條件的 AI 工具</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.2rem;">您可以嘗試更換搜尋關鍵字、切換至「全部工具」，或直接新增一個工具！</p>
        <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="resetFilters()">🔄 顯示全部工具</button>
          <button class="btn btn-primary" onclick="openCmsWithNewTool()">➕ 立即新增 AI 工具</button>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((tool) => {
      const cat = state.data.categories.find((c) => c.id === tool.category) || {
        icon: "📌",
        name: "未分類"
      };

      // 建立卡片上的快速連結與檔案下載預覽列（讓訪客在首頁就能一目了然！）
      const linksHtml = (tool.links || [])
        .map(
          (lnk) => `
          <div class="quick-res-item">
            <a href="${escapeAttr(lnk.url)}" target="_blank" rel="noopener noreferrer" class="quick-res-link" title="${escapeAttr(lnk.note || lnk.url)}">
              <span>🔗 ${escapeHtml(lnk.label)}</span>
              <span style="font-size:0.75rem; opacity:0.7;">↗</span>
            </a>
            ${
              lnk.showQr
                ? `<button class="qr-mini-btn" onclick="openQrModal('${escapeJsStr(tool.title + " - " + lnk.label)}', '${escapeJsStr(lnk.url)}', '${escapeJsStr(lnk.note || "")}')" title="放大顯示課堂掃描 QR Code">📱 掃碼</button>`
                : ""
            }
          </div>
        `
        )
        .join("");

      const downloadsHtml = (tool.downloads || [])
        .map(
          (dl) => `
          <div class="quick-res-item">
            <a href="${escapeAttr(dl.url)}" target="_blank" rel="noopener noreferrer" download class="quick-res-link" style="color: var(--accent-pine);" title="${escapeAttr(dl.description || dl.url)}">
              <span>${escapeHtml(dl.label)}</span>
            </a>
            <span style="font-size:0.72rem; padding:0.1rem 0.45rem; border-radius:4px; background:var(--accent-pine-soft); color:var(--accent-pine); font-weight:700; white-space:nowrap;">${escapeHtml(dl.fileType || "檔案下載")}</span>
          </div>
        `
        )
        .join("");

      const hasQuickRes = linksHtml || downloadsHtml;

      const tagsHtml = (tool.tags || [])
        .map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`)
        .join("");

      const primaryLink = tool.links && tool.links.length > 0 ? tool.links[0] : null;

      return `
        <article class="tool-card ${tool.featured ? "featured-card" : ""}">
          <div>
            <div class="card-top-bar">
              <span class="cat-pill">${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</span>
              <div class="badge-group">
                ${tool.featured ? `<span class="featured-badge">🌟 主打工具</span>` : ""}
                ${
                  tool.isReal
                    ? `<span class="real-badge">✅ 實戰上線</span>`
                    : `<span class="tag-chip" title="可於右上角管理後台編輯或刪除">💡 預設範例</span>`
                }
              </div>
            </div>

            <h3 class="tool-title" onclick="openToolDetail('${escapeJsStr(tool.id)}')">
              ${escapeHtml(tool.title)}
            </h3>

            <p class="tool-summary">${escapeHtml(tool.summary)}</p>

            ${
              hasQuickRes
                ? `
                <div class="card-quick-resources">
                  <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:0.15rem;">⚡ 快速應用入口與檔案下載：</div>
                  ${linksHtml}
                  ${downloadsHtml}
                </div>
              `
                : ""
            }

            <div class="tag-list">${tagsHtml}</div>
          </div>

          <div class="card-footer">
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; flex:1;">
              <button class="btn btn-primary" style="flex:1;" onclick="openToolDetail('${escapeJsStr(tool.id)}')">
                📖 完整指南與步驟
              </button>
              ${
                primaryLink
                  ? `<a href="${escapeAttr(primaryLink.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" title="直接在新分頁開啟主應用網址">🚀 開啟應用</a>`
                  : ""
              }
            </div>
            <div class="card-admin-btns">
              <button class="btn btn-ghost btn-icon" onclick="openCmsToEditTool('${escapeJsStr(tool.id)}')" title="編輯此工具內容">✏️</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

// ============================================================================
// 工具詳情與使用指南視窗 (Detail Modal)
// ============================================================================

function openToolDetail(toolId) {
  const tool = state.data.tools.find((t) => t.id === toolId);
  if (!tool) return;

  const cat = state.data.categories.find((c) => c.id === tool.category) || {
    icon: "📌",
    name: "未分類"
  };

  const modal = document.getElementById("detailModal");
  const headerContent = document.getElementById("detailModalHeader");
  const bodyContent = document.getElementById("detailModalBody");

  headerContent.innerHTML = `
    <div>
      <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.5rem;">
        <span class="cat-pill">${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</span>
        ${tool.difficulty ? `<span class="real-badge">${escapeHtml(tool.difficulty)}</span>` : ""}
        ${tool.techStack ? `<span class="tag-chip">🛠️ ${escapeHtml(tool.techStack)}</span>` : ""}
        <span class="tag-chip">📅 更新：${escapeHtml(tool.updatedAt || state.data.lastUpdated)}</span>
      </div>
      <h2 style="font-family:var(--font-serif); font-size:clamp(1.4rem, 2.5vw, 1.85rem); font-weight:900; line-height:1.3;">
        ${escapeHtml(tool.title)}
      </h2>
    </div>
    <div style="display:flex; gap:0.5rem; align-items:center;">
      <button class="btn btn-secondary" style="padding:0.4rem 0.85rem; font-size:0.82rem;" onclick="closeDetailModal(); openCmsToEditTool('${escapeJsStr(tool.id)}')">
        ✏️ 編輯此工具
      </button>
      <button class="modal-close-btn" onclick="closeDetailModal()" aria-label="關閉視窗">✕</button>
    </div>
  `;

  // 1. 痛點與解決方案對照
  const whyHtml =
    tool.painPoint || tool.solution
      ? `
      <div class="detail-grid-2">
        <div class="info-panel" style="border-left: 4px solid #E53E3E;">
          <div class="info-panel-title" style="color: #C53030;">🤔 現場常見痛點 (Before)</div>
          <p style="font-size:0.92rem; color:var(--text-secondary);">${escapeHtml(tool.painPoint || "傳統作業流程繁瑣耗時。")}</p>
        </div>
        <div class="info-panel" style="border-left: 4px solid var(--accent-pine);">
          <div class="info-panel-title" style="color: var(--accent-pine);">✨ AI 賦能解方 (After)</div>
          <p style="font-size:0.92rem; color:var(--text-secondary);">${escapeHtml(tool.solution || tool.summary)}</p>
        </div>
      </div>
    `
      : `<p style="font-size:1rem; color:var(--text-secondary);">${escapeHtml(tool.summary)}</p>`;

  // 2. 應用連結與檔案下載中樞 (Action Hub)
  const linksCards = (tool.links || [])
    .map(
      (lnk, idx) => `
      <div class="action-link-card">
        <div class="action-link-info">
          <div style="font-weight:800; font-size:1rem; color:var(--text-primary);">${escapeHtml(lnk.label)}</div>
          <div class="action-link-url">${escapeHtml(lnk.url)}</div>
          ${lnk.note ? `<div class="action-link-note">💡 ${escapeHtml(lnk.note)}</div>` : ""}
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button class="btn btn-ghost" style="padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="copyText('${escapeJsStr(lnk.url)}', '已複製網址！')">
            📋 複製網址
          </button>
          <button class="btn btn-secondary" style="padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="openQrModal('${escapeJsStr(tool.title + " - " + lnk.label)}', '${escapeJsStr(lnk.url)}', '${escapeJsStr(lnk.note || "")}')">
            📱 顯示 QR Code
          </button>
          <a href="${escapeAttr(lnk.url)}" target="_blank" rel="noopener noreferrer" class="btn ${idx === 0 ? "btn-primary" : "btn-pine"}" style="padding:0.45rem 1rem; font-size:0.88rem;">
            🚀 立即開啟 ↗
          </a>
        </div>
      </div>
    `
    )
    .join("");

  const downloadsCards = (tool.downloads || [])
    .map(
      (dl) => `
      <div class="action-link-card" style="border-style:dashed; background:var(--bg-elevated);">
        <div class="action-link-info">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-weight:800; font-size:1rem; color:var(--accent-pine);">${escapeHtml(dl.label)}</span>
            <span class="real-badge">${escapeHtml(dl.fileType || "檔案下載")}</span>
          </div>
          <div class="action-link-url">${escapeHtml(dl.url)}</div>
          ${dl.description ? `<div class="action-link-note">${escapeHtml(dl.description)}</div>` : ""}
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <a href="${escapeAttr(dl.url)}" target="_blank" rel="noopener noreferrer" download class="btn btn-pine" style="padding:0.5rem 1.1rem; font-size:0.88rem;">
            📥 直接下載檔案
          </a>
        </div>
      </div>
    `
    )
    .join("");

  const actionHubHtml =
    linksCards || downloadsCards
      ? `
      <div class="action-hub">
        <div class="action-hub-title">🚀 應用連結與配套檔案下載專區</div>
        <div class="action-links-list">
          ${linksCards}
          ${downloadsCards}
        </div>
      </div>
    `
      : "";

  // 3. Step-by-Step 使用指南
  const stepsHtml =
    tool.steps && tool.steps.length > 0
      ? `
      <div>
        <h3 style="font-family:var(--font-serif); font-size:1.18rem; font-weight:800; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.5rem;">
          🧭 一目了然：Step-by-Step 實戰操作指南
        </h3>
        <div class="steps-list">
          ${tool.steps
            .map(
              (st, i) => `
              <div class="step-item">
                <div class="step-number">${i + 1}</div>
                <div class="step-content-wrap">
                  <h4>${escapeHtml(st.title)}</h4>
                  <p>${escapeHtml(st.content)}</p>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      </div>
    `
      : "";

  // 4. AI 提示詞 (Prompt) 複製區
  const promptHtml = tool.promptText
    ? `
      <div>
        <div class="prompt-box">
          <div class="prompt-header">
            <span>${escapeHtml(tool.promptTitle || "📋 搭配使用的 AI 提示詞 (Prompt 咒語)")}</span>
            <button class="btn btn-primary" style="padding:0.35rem 0.9rem; font-size:0.82rem;" onclick="copyPromptById('${escapeJsStr(tool.id)}')">
              📋 一鍵複製完整咒語
            </button>
          </div>
          <pre class="prompt-pre">${escapeHtml(tool.promptText)}</pre>
        </div>
      </div>
    `
    : "";

  // 5. 校長私房叮嚀
  const tipsHtml = tool.tips
    ? `
      <div class="tips-box">${escapeHtml(tool.tips)}</div>
    `
    : "";

  bodyContent.innerHTML = `
    ${whyHtml}
    ${actionHubHtml}
    ${stepsHtml}
    ${promptHtml}
    ${tipsHtml}
  `;

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDetailModal() {
  const modal = document.getElementById("detailModal");
  if (modal) modal.classList.remove("open");
  document.body.style.overflow = "";
}

function copyPromptById(toolId) {
  const tool = state.data.tools.find((t) => t.id === toolId);
  if (tool && tool.promptText) {
    copyText(tool.promptText, "🎉 已複製 AI 提示詞咒語！可直接貼至 ChatGPT 或 Gemini 使用。");
  }
}

// ============================================================================
// 課堂投影專用 QR Code 視窗
// ============================================================================

function openQrModal(title, url, note) {
  const modal = document.getElementById("qrModal");
  const titleEl = document.getElementById("qrModalTitle");
  const urlEl = document.getElementById("qrModalUrl");
  const noteEl = document.getElementById("qrModalNote");
  const imgWrap = document.getElementById("qrImageWrap");

  titleEl.textContent = title;
  urlEl.textContent = url;
  urlEl.href = url;
  noteEl.textContent = note || "請使用平板或手機相機掃描上方 QR Code 直接進入";

  // 使用高穩定度的 QR Code API 生成清晰大圖，供教室大螢幕投影
  const encodedUrl = encodeURIComponent(url);
  imgWrap.innerHTML = `
    <img 
      src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodedUrl}" 
      alt="QR Code for ${escapeAttr(title)}" 
      width="260" 
      height="260"
      style="display:block; border-radius:8px;"
    />
  `;

  modal.classList.add("open");
}

function closeQrModal() {
  const modal = document.getElementById("qrModal");
  if (modal) modal.classList.remove("open");
}

// ============================================================================
// ⚙️ 隨時更新管理工坊 (Visual CMS) 邏輯
// ============================================================================

function openCmsModal(tab = "tools-list") {
  state.cmsActiveTab = tab;
  const modal = document.getElementById("cmsModal");
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  renderCmsContent();
}

function closeCmsModal() {
  const modal = document.getElementById("cmsModal");
  if (modal) modal.classList.remove("open");
  document.body.style.overflow = "";
}

function openCmsWithNewTool() {
  state.editingToolId = null;
  openCmsModal("tool-form");
}

function openCmsToEditTool(toolId) {
  state.editingToolId = toolId;
  openCmsModal("tool-form");
}

function switchCmsTab(tab) {
  if (tab === "tool-form" && !state.editingToolId) {
    state.editingToolId = null;
  }
  state.cmsActiveTab = tab;
  renderCmsContent();
}

function renderCmsContent() {
  const tabsContainer = document.getElementById("cmsTabs");
  const bodyContainer = document.getElementById("cmsBody");

  const tabs = [
    { id: "tools-list", label: `🛠️ 工具總覽與排序 (${state.data.tools.length})` },
    { id: "tool-form", label: state.editingToolId ? "✏️ 編輯工具內容" : "➕ 新增 AI 工具" },
    { id: "categories", label: `📂 管理分類 (${state.data.categories.length})` },
    { id: "site-info", label: "🏠 網站標題與校長簡介" },
    { id: "sync", label: "💾 永久存檔 / 匯出更新" }
  ];

  tabsContainer.innerHTML = tabs
    .map(
      (t) => `
      <button class="cat-tab ${state.cmsActiveTab === t.id ? "active" : ""}" onclick="switchCmsTab('${t.id}')">
        ${t.label}
      </button>
    `
    )
    .join("");

  if (state.cmsActiveTab === "tools-list") {
    renderCmsToolsList(bodyContainer);
  } else if (state.cmsActiveTab === "tool-form") {
    renderCmsToolForm(bodyContainer);
  } else if (state.cmsActiveTab === "categories") {
    renderCmsCategories(bodyContainer);
  } else if (state.cmsActiveTab === "site-info") {
    renderCmsSiteInfo(bodyContainer);
  } else if (state.cmsActiveTab === "sync") {
    renderCmsSync(bodyContainer);
  }
}

// CMS Tab 1: 工具清單管理
function renderCmsToolsList(container) {
  const rows = state.data.tools
    .map((tool, index) => {
      const cat = state.data.categories.find((c) => c.id === tool.category) || {
        icon: "📌",
        name: "未分類"
      };
      return `
        <div class="action-link-card" style="margin-bottom:0.75rem;">
          <div style="display:flex; flex-direction:column; gap:0.25rem; flex:1;">
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <span class="cat-pill">${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</span>
              ${tool.featured ? `<span class="featured-badge">🌟 主打</span>` : ""}
              ${tool.isReal ? `<span class="real-badge">✅ 實戰</span>` : `<span class="tag-chip">💡 範例</span>`}
              <strong style="font-size:1.05rem;">${escapeHtml(tool.title)}</strong>
            </div>
            <div style="font-size:0.84rem; color:var(--text-muted);">
              包含 ${(tool.links || []).length} 個應用連結、${(tool.downloads || []).length} 個下載檔、${(tool.steps || []).length} 個步驟
            </div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="btn btn-ghost" style="padding:0.35rem 0.65rem;" onclick="moveTool(${index}, -1)" ${index === 0 ? "disabled" : ""} title="往上移">↑</button>
            <button class="btn btn-ghost" style="padding:0.35rem 0.65rem;" onclick="moveTool(${index}, 1)" ${index === state.data.tools.length - 1 ? "disabled" : ""} title="往下移">↓</button>
            <button class="btn btn-secondary" style="padding:0.35rem 0.85rem; font-size:0.84rem;" onclick="openCmsToEditTool('${escapeJsStr(tool.id)}')">✏️ 編輯</button>
            <button class="btn btn-ghost" style="padding:0.35rem 0.85rem; font-size:0.84rem; color:#E53E3E;" onclick="deleteTool('${escapeJsStr(tool.id)}')">🗑️ 刪除</button>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="save-banner" style="margin-bottom:1.25rem;">
      <div>
        <strong>💡 隨時更新小提醒：</strong>您在這裡新增或修改任何工具後，畫面會立即生效！若要永久更新至網站檔案，請點擊右方按鈕儲存 <code>tools-data.js</code>。
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="openCmsWithNewTool()">➕ 新增一個 AI 工具</button>
        <button class="btn btn-pine" onclick="saveToToolsDataFile()">💾 儲存更新 tools-data.js</button>
      </div>
    </div>
    <div>${rows}</div>
  `;
}

function moveTool(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= state.data.tools.length) return;
  const arr = state.data.tools;
  const temp = arr[index];
  arr[index] = arr[newIndex];
  arr[newIndex] = temp;
  saveDataToLocal("✅ 已調整工具顯示順序！");
  renderCmsContent();
}

function deleteTool(toolId) {
  const tool = state.data.tools.find((t) => t.id === toolId);
  if (!tool) return;
  if (!confirm(`確定要刪除「${tool.title}」嗎？`)) return;
  state.data.tools = state.data.tools.filter((t) => t.id !== toolId);
  saveDataToLocal("🗑️ 已刪除該工具！");
  renderCmsContent();
}

// CMS Tab 2: 新增／編輯單一工具表單
function renderCmsToolForm(container) {
  const existing = state.editingToolId
    ? state.data.tools.find((t) => t.id === state.editingToolId)
    : null;

  const tool = existing
    ? JSON.parse(JSON.stringify(existing))
    : {
        id: "tool-" + Date.now(),
        title: "",
        category: state.data.categories[0]?.id || "teaching",
        featured: true,
        isReal: true,
        difficulty: "⭐ 零門檻・即開即用",
        tags: ["AI工具", "校園應用"],
        techStack: "Web App / AI 助手",
        updatedAt: new Date().toISOString().slice(0, 10),
        summary: "",
        painPoint: "",
        solution: "",
        links: [
          { label: "🚀 主應用網址", url: "https://", type: "primary", showQr: true, note: "" }
        ],
        downloads: [],
        steps: [
          { title: "步驟一：開啟工具或下載範本", content: "" },
          { title: "步驟二：開始互動與應用", content: "" }
        ],
        promptTitle: "📋 搭配使用的 AI 提示詞 (選填)",
        promptText: "",
        tips: ""
      };

  // 暫存至 window 供表單動態增減列操作
  window._draftTool = tool;

  drawDraftToolForm(container);
}

function drawDraftToolForm(container) {
  const t = window._draftTool;
  const catOptions = state.data.categories
    .map(
      (c) =>
        `<option value="${escapeAttr(c.id)}" ${t.category === c.id ? "selected" : ""}>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`
    )
    .join("");

  const linksRows = (t.links || [])
    .map(
      (lnk, i) => `
      <div class="dynamic-row" style="grid-template-columns: 1fr 1.3fr 1fr auto auto;">
        <input class="form-input" placeholder="按鈕名稱 (如：教師主持端)" value="${escapeAttr(lnk.label || "")}" oninput="window._draftTool.links[${i}].label = this.value" />
        <input class="form-input" placeholder="網址 https://..." value="${escapeAttr(lnk.url || "")}" oninput="window._draftTool.links[${i}].url = this.value" />
        <input class="form-input" placeholder="備註說明 (選填)" value="${escapeAttr(lnk.note || "")}" oninput="window._draftTool.links[${i}].note = this.value" />
        <label style="font-size:0.8rem; display:flex; align-items:center; gap:0.25rem; white-space:nowrap;">
          <input type="checkbox" ${lnk.showQr ? "checked" : ""} onchange="window._draftTool.links[${i}].showQr = this.checked" /> 附掃碼鈕
        </label>
        <button type="button" class="btn btn-ghost" style="color:#E53E3E; padding:0.35rem 0.6rem;" onclick="removeDraftLink(${i})">✕</button>
      </div>
    `
    )
    .join("");

  const downloadsRows = (t.downloads || [])
    .map(
      (dl, i) => `
      <div class="dynamic-row" style="grid-template-columns: 1fr 1.3fr 0.7fr auto;">
        <input class="form-input" placeholder="下載按鈕文字 (如：📥 題庫 CSV 範例檔)" value="${escapeAttr(dl.label || "")}" oninput="window._draftTool.downloads[${i}].label = this.value" />
        <input class="form-input" placeholder="檔案下載網址 https://..." value="${escapeAttr(dl.url || "")}" oninput="window._draftTool.downloads[${i}].url = this.value" />
        <input class="form-input" placeholder="檔案類型 (如：CSV 範本)" value="${escapeAttr(dl.fileType || "")}" oninput="window._draftTool.downloads[${i}].fileType = this.value" />
        <button type="button" class="btn btn-ghost" style="color:#E53E3E; padding:0.35rem 0.6rem;" onclick="removeDraftDownload(${i})">✕</button>
      </div>
    `
    )
    .join("");

  const stepsRows = (t.steps || [])
    .map(
      (st, i) => `
      <div class="dynamic-row" style="grid-template-columns: 0.9fr 1.8fr auto;">
        <input class="form-input" placeholder="步驟 ${i + 1} 標題" value="${escapeAttr(st.title || "")}" oninput="window._draftTool.steps[${i}].title = this.value" />
        <input class="form-input" placeholder="步驟詳細說明..." value="${escapeAttr(st.content || "")}" oninput="window._draftTool.steps[${i}].content = this.value" />
        <button type="button" class="btn btn-ghost" style="color:#E53E3E; padding:0.35rem 0.6rem;" onclick="removeDraftStep(${i})">✕</button>
      </div>
    `
    )
    .join("");

  container.innerHTML = `
    <form onsubmit="submitToolForm(event)">
      <div class="cms-form-grid">
        <div class="form-group">
          <label class="form-label">📌 工具名稱 (必填)</label>
          <input class="form-input" required placeholder="例如：Kahoot! 課堂即時互動問卷與搶答系統" value="${escapeAttr(t.title)}" oninput="window._draftTool.title = this.value" />
        </div>

        <div class="form-group">
          <label class="form-label">📂 所屬分類</label>
          <select class="form-select" onchange="window._draftTool.category = this.value">
            ${catOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">🏷️ 關鍵字標籤 (以逗號分隔)</label>
          <input class="form-input" placeholder="課堂互動, 即時搶答, CSV題庫" value="${escapeAttr((t.tags || []).join(", "))}" oninput="window._draftTool.tags = this.value.split(',').map(s=>s.trim()).filter(Boolean)" />
        </div>

        <div class="form-group">
          <label class="form-label">🛠️ 技術類型與難度標示</label>
          <div style="display:flex; gap:0.6rem; align-items:center;">
            <input class="form-input" placeholder="如：AI 輔助開發 Web App" value="${escapeAttr(t.techStack || "")}" oninput="window._draftTool.techStack = this.value" />
            <label style="white-space:nowrap; font-size:0.85rem; display:flex; align-items:center; gap:0.25rem;">
              <input type="checkbox" ${t.featured ? "checked" : ""} onchange="window._draftTool.featured = this.checked" /> 🌟 設為主打
            </label>
            <label style="white-space:nowrap; font-size:0.85rem; display:flex; align-items:center; gap:0.25rem;">
              <input type="checkbox" ${t.isReal ? "checked" : ""} onchange="window._draftTool.isReal = this.checked" /> ✅ 實戰上線
            </label>
          </div>
        </div>

        <div class="form-group full-width">
          <label class="form-label">📝 一句話亮點摘要 (顯示於首頁卡片，必填)</label>
          <textarea class="form-textarea" style="min-height:68px;" required placeholder="簡短說明這個工具能幫老師或行政人員解決什麼問題..." oninput="window._draftTool.summary = this.value">${escapeHtml(t.summary)}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">🤔 現場常見痛點 (選填，顯示於詳情頁)</label>
          <textarea class="form-textarea" style="min-height:68px;" placeholder="原本沒有這個工具時遇到的困難..." oninput="window._draftTool.painPoint = this.value">${escapeHtml(t.painPoint || "")}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">✨ AI 賦能解方 (選填，顯示於詳情頁)</label>
          <textarea class="form-textarea" style="min-height:68px;" placeholder="這個工具如何優雅地解決問題..." oninput="window._draftTool.solution = this.value">${escapeHtml(t.solution || "")}</textarea>
        </div>
      </div>

      <!-- 動態應用連結區 -->
      <div class="dynamic-list-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem;">
          <label class="form-label">🔗 應用網址連結（可設定多個入口，如：教師主持端、學生手機作答端）</label>
          <button type="button" class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" onclick="addDraftLink()">➕ 新增一個連結按钮</button>
        </div>
        ${linksRows || `<div class="form-hint">目前尚無應用連結，點擊右上角可新增。</div>`}
      </div>

      <!-- 動態檔案下載區 -->
      <div class="dynamic-list-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem;">
          <label class="form-label">📥 配套檔案下載（如：CSV 題庫範例檔、Word 學習單、PDF 講義網址）</label>
          <button type="button" class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" onclick="addDraftDownload()">➕ 新增一個下載檔案</button>
        </div>
        ${downloadsRows || `<div class="form-hint">目前尚無附加下載檔案，點擊右上角可新增。</div>`}
      </div>

      <!-- 動態使用指南步驟區 -->
      <div class="dynamic-list-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem;">
          <label class="form-label">🧭 Step-by-Step 使用指南步驟</label>
          <button type="button" class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" onclick="addDraftStep()">➕ 新增一個操作步驟</button>
        </div>
        ${stepsRows || `<div class="form-hint">點擊右上角可新增步驟說明。</div>`}
      </div>

      <div class="cms-form-grid">
        <div class="form-group full-width">
          <label class="form-label">🤖 搭配的 AI 提示詞 (Prompt 咒語，選填 — 讓使用者可一鍵複製)</label>
          <textarea class="form-textarea" placeholder="若此工具可搭配 ChatGPT / Gemini 提示詞（例如自動生成 CSV 題庫的指令），請貼在這裡..." oninput="window._draftTool.promptText = this.value">${escapeHtml(t.promptText || "")}</textarea>
        </div>

        <div class="form-group full-width">
          <label class="form-label">💡 校長私房叮嚀與教學小撇步 (選填)</label>
          <textarea class="form-textarea" style="min-height:68px;" placeholder="提醒老師使用時的注意事項或私房技巧..." oninput="window._draftTool.tips = this.value">${escapeHtml(t.tips || "")}</textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; padding-top:1rem; border-top:1px solid var(--border-subtle);">
        <button type="button" class="btn btn-ghost" onclick="switchCmsTab('tools-list')">取消返回</button>
        <button type="submit" class="btn btn-primary">💾 儲存此工具並立即更新網站</button>
      </div>
    </form>
  `;
}

function addDraftLink() {
  window._draftTool.links.push({ label: "", url: "https://", showQr: true, note: "" });
  drawDraftToolForm(document.getElementById("cmsBody"));
}
function removeDraftLink(i) {
  window._draftTool.links.splice(i, 1);
  drawDraftToolForm(document.getElementById("cmsBody"));
}
function addDraftDownload() {
  window._draftTool.downloads.push({ label: "📥 下載範例檔", url: "https://", fileType: "範例檔", description: "" });
  drawDraftToolForm(document.getElementById("cmsBody"));
}
function removeDraftDownload(i) {
  window._draftTool.downloads.splice(i, 1);
  drawDraftToolForm(document.getElementById("cmsBody"));
}
function addDraftStep() {
  window._draftTool.steps.push({ title: "", content: "" });
  drawDraftToolForm(document.getElementById("cmsBody"));
}
function removeDraftStep(i) {
  window._draftTool.steps.splice(i, 1);
  drawDraftToolForm(document.getElementById("cmsBody"));
}

function submitToolForm(e) {
  e.preventDefault();
  const draft = window._draftTool;
  draft.updatedAt = new Date().toISOString().slice(0, 10);

  // 過濾空白連結與步驟
  draft.links = (draft.links || []).filter((l) => l.label.trim() && l.url.trim());
  draft.downloads = (draft.downloads || []).filter((d) => d.label.trim() && d.url.trim());
  draft.steps = (draft.steps || []).filter((s) => s.title.trim() || s.content.trim());

  const idx = state.data.tools.findIndex((t) => t.id === draft.id);
  if (idx >= 0) {
    state.data.tools[idx] = draft;
  } else {
    state.data.tools.unshift(draft);
  }

  state.editingToolId = null;
  saveDataToLocal(`🎉 已成功儲存工具「${draft.title}」！`);
  switchCmsTab("tools-list");
}

// CMS Tab 3: 分類管理與擴充
function renderCmsCategories(container) {
  const rows = state.data.categories
    .map(
      (cat, i) => `
      <div class="dynamic-row" style="grid-template-columns: 70px 1fr 1.6fr auto;">
        <input class="form-input" value="${escapeAttr(cat.icon)}" onchange="updateCategoryField(${i}, 'icon', this.value)" title="分類代表 Emoji 圖示" />
        <input class="form-input" value="${escapeAttr(cat.name)}" onchange="updateCategoryField(${i}, 'name', this.value)" placeholder="分類名稱" />
        <input class="form-input" value="${escapeAttr(cat.description)}" onchange="updateCategoryField(${i}, 'description', this.value)" placeholder="分類說明文字" />
        <button class="btn btn-ghost" style="color:#E53E3E;" onclick="deleteCategory(${i})" title="刪除此分類">🗑️</button>
      </div>
    `
    )
    .join("");

  container.innerHTML = `
    <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h3 style="font-family:var(--font-serif); font-size:1.15rem;">📂 網站分類架構（支援無限擴充）</h3>
        <p class="form-hint">除了必備的「教學」與「行政」外，您可隨時在此修改分類名稱或新增更多面向。</p>
      </div>
      <button class="btn btn-primary" onclick="addNewCategory()">➕ 新增一個分類</button>
    </div>
    <div class="dynamic-list-box">
      ${rows}
    </div>
  `;
}

function updateCategoryField(index, field, value) {
  state.data.categories[index][field] = value;
  saveDataToLocal("✅ 已更新分類設定！");
}

function addNewCategory() {
  const newId = "cat-" + Date.now();
  state.data.categories.push({
    id: newId,
    name: "新擴充分類",
    icon: "✨",
    color: "#2B6CB0",
    description: "請輸入此分類的工具應用說明"
  });
  saveDataToLocal("➕ 已新增一個分類！");
  renderCmsContent();
}

function deleteCategory(index) {
  const cat = state.data.categories[index];
  if (state.data.categories.length <= 1) {
    alert("至少需保留一個分類！");
    return;
  }
  if (!confirm(`確定要刪除「${cat.name}」分類嗎？`)) return;
  state.data.categories.splice(index, 1);
  if (state.activeCategory === cat.id) state.activeCategory = "all";
  saveDataToLocal("🗑️ 已刪除分類！");
  renderCmsContent();
}

// CMS Tab 4: 網站標題與校長簡介設定
function renderCmsSiteInfo(container) {
  const info = state.data.siteInfo;
  container.innerHTML = `
    <form onsubmit="saveSiteInfoForm(event)">
      <div class="cms-form-grid">
        <div class="form-group">
          <label class="form-label">🏠 網站主標題</label>
          <input class="form-input" id="si_title" required value="${escapeAttr(info.title)}" />
        </div>
        <div class="form-group">
          <label class="form-label">✨ 網站副標題</label>
          <input class="form-input" id="si_subtitle" value="${escapeAttr(info.subtitle)}" />
        </div>
        <div class="form-group full-width">
          <label class="form-label">💬 首頁核心標語 (金句)</label>
          <input class="form-input" id="si_quote" value="${escapeAttr(info.heroQuote)}" />
        </div>
        <div class="form-group full-width">
          <label class="form-label">📖 首頁導覽介紹文字</label>
          <textarea class="form-textarea" id="si_desc">${escapeHtml(info.heroDescription)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">👨‍🏫 校長名片標題／稱呼</label>
          <input class="form-input" id="si_pname" value="${escapeAttr(info.principalName)}" />
        </div>
        <div class="form-group">
          <label class="form-label">🎖️ 頭銜與定位</label>
          <input class="form-input" id="si_ptitle" value="${escapeAttr(info.principalTitle)}" />
        </div>
        <div class="form-group full-width">
          <label class="form-label">🌱 校長理念簡介</label>
          <textarea class="form-textarea" id="si_pbio">${escapeHtml(info.principalBio)}</textarea>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; padding-top:1rem;">
        <button type="submit" class="btn btn-primary">💾 儲存網站基本資訊</button>
      </div>
    </form>
  `;
}

function saveSiteInfoForm(e) {
  e.preventDefault();
  const info = state.data.siteInfo;
  info.title = document.getElementById("si_title").value.trim();
  info.subtitle = document.getElementById("si_subtitle").value.trim();
  info.heroQuote = document.getElementById("si_quote").value.trim();
  info.heroDescription = document.getElementById("si_desc").value.trim();
  info.principalName = document.getElementById("si_pname").value.trim();
  info.principalTitle = document.getElementById("si_ptitle").value.trim();
  info.principalBio = document.getElementById("si_pbio").value.trim();

  saveDataToLocal("🎉 已更新網站標題與校長簡介！");
}

// CMS Tab 5: 永久存檔與匯出／匯入同步
function renderCmsSync(container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div class="info-panel" style="border:2px solid var(--accent-pine); background:var(--accent-pine-soft);">
        <h3 style="font-family:var(--font-serif); font-size:1.2rem; margin-bottom:0.5rem; color:var(--accent-pine);">
          💾 方式一：一鍵儲存並更新網站資料檔 (<code>tools-data.js</code>) 【最推薦】
        </h3>
        <p style="font-size:0.92rem; color:var(--text-secondary); margin-bottom:1rem;">
          當您在管理後台新增或修改了工具，點擊下方按鈕並選擇網站資料夾中的 <code>tools-data.js</code> 覆蓋存檔。這樣無論您是放在雲端硬碟或是上傳到 GitHub Pages，所有造訪網站的人都能看到您最新更新的內容！
        </p>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <button class="btn btn-pine" onclick="saveToToolsDataFile()">
            💾 直接寫入 / 儲存 tools-data.js 檔案
          </button>
          <button class="btn btn-secondary" onclick="downloadToolsDataFile()">
            📥 下載 tools-data.js 檔案
          </button>
        </div>
      </div>

      <div class="info-panel">
        <h3 style="font-family:var(--font-serif); font-size:1.15rem; margin-bottom:0.5rem;">
          📤 方式二：JSON 資料備份匯出與匯入
        </h3>
        <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:0.9rem;">
          您也可以將整站資料匯出為 JSON 備份檔，或從電腦選取之前的備份檔一鍵還原。
        </p>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-secondary" onclick="exportJsonBackup()">📦 匯出 JSON 備份檔</button>
          <label class="btn btn-secondary" style="cursor:pointer;">
            📂 匯入 JSON 備份檔
            <input type="file" accept=".json" style="display:none;" onchange="importJsonBackup(event)" />
          </label>
          <button class="btn btn-ghost" style="color:#E53E3E; margin-left:auto;" onclick="resetToDefaultFile()">
            🔄 清除瀏覽器暫存（重新讀取原始 tools-data.js）
          </button>
        </div>
      </div>
    </div>
  `;
}

function exportJsonBackup() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `閒閒罔飛ㄟ所在_備份_${state.data.lastUpdated}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("📦 已匯出 JSON 備份檔！");
}

function importJsonBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && Array.isArray(parsed.tools) && Array.isArray(parsed.categories)) {
        state.data = parsed;
        saveDataToLocal("🎉 已成功匯入備份資料！");
        renderCmsContent();
      } else {
        alert("檔案格式不正確，請確認是否為本站匯出的 JSON 備份檔。");
      }
    } catch (err) {
      alert("讀取 JSON 檔案失敗：" + err.message);
    }
  };
  reader.readAsText(file);
}

function resetToDefaultFile() {
  if (!confirm("確定要清除瀏覽器的暫存修改，重新載入 tools-data.js 檔案中的設定嗎？")) return;
  localStorage.removeItem(STORAGE_KEY);
  state.data = JSON.parse(JSON.stringify(window.SITE_DATA));
  renderAll();
  renderCmsContent();
  showToast("🔄 已還原為 tools-data.js 檔案內容！");
}

// ============================================================================
// 搜尋、篩選、深淺色主題與輔助工具函式
// ============================================================================

function setCategory(catId) {
  state.activeCategory = catId;
  renderCategoryTabs();
  renderToolsGrid();
}

function onSearchInput(value) {
  state.searchQuery = value;
  const clearBtn = document.getElementById("searchClearBtn");
  if (clearBtn) {
    clearBtn.style.display = value.trim() ? "block" : "none";
  }
  renderToolsGrid();
}

function resetFilters() {
  state.activeCategory = "all";
  state.searchQuery = "";
  const input = document.getElementById("searchInput");
  if (input) input.value = "";
  const clearBtn = document.getElementById("searchClearBtn");
  if (clearBtn) clearBtn.style.display = "none";
  renderCategoryTabs();
  renderToolsGrid();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("AI_PRINCIPAL_THEME", next);
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.textContent = next === "dark" ? "☀️" : "🌙";
}

function copyText(text, successMsg = "📋 已複製到剪貼簿！") {
  navigator.clipboard.writeText(text).then(
    () => showToast(successMsg),
    () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(successMsg);
    }
  );
}

function showToast(message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function escapeJsStr(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}

// 頁面啟動與快捷鍵綁定
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("AI_PRINCIPAL_THEME");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.textContent = "☀️";
  }

  initData();
  renderAll();

  // 點擊背景遮罩關閉視窗
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
  });

  // ESC 鍵關閉彈窗
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDetailModal();
      closeQrModal();
      closeCmsModal();
    }
  });
});
