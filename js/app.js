import {
  TOTAL_COMBINATIONS,
  buildScenario,
  queryScenariosAsync,
  persons,
  housingUsages,
  moments,
  residentials,
  events,
} from './generator.js';
import { DIMENSIONS } from './dimensions.js';

const PAGE_SIZE = 40;
const state = {
  filters: {
    person: [],
    housingUsage: [],
    moment: [],
    residential: [],
    event: [],
    search: '',
  },
  minRelevance: 40,
  showAll: false,
  page: 0,
  expandedId: null,
  cache: new Map(),
  total: 0,
  cancelQuery: null,
  renderGen: 0,
};

const el = {
  totalAll: document.getElementById('total-all'),
  totalFiltered: document.getElementById('total-filtered'),
  scenarioList: document.getElementById('scenario-list'),
  pageInfo: document.getElementById('page-info'),
  pageInput: document.getElementById('page-input'),
  btnGoPage: document.getElementById('btn-go-page'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  search: document.getElementById('search'),
  showAllToggle: document.getElementById('show-all'),
  minRelevance: document.getElementById('min-relevance'),
  relevanceVal: document.getElementById('relevance-val'),
  btnReset: document.getElementById('btn-reset'),
};

function init() {
  el.totalAll.textContent = TOTAL_COMBINATIONS.toLocaleString();
  document.getElementById('formula-text').innerHTML =
    `<code>${persons.length}</code>人 × <code>${housingUsages.length}</code>用房 × <code>${moments.length}</code>时刻 × <code>${residentials.length}</code>住宅 × <code>${events.length}</code>事件`;

  buildFilterUI();
  bindEvents();
  render();
}

function buildFilterUI() {
  const container = document.getElementById('filters');

  // 人物：按类别分组
  const personGroup = document.createElement('div');
  personGroup.className = 'filter-group';
  personGroup.innerHTML = '<label>人物</label>';
  const personWrap = document.createElement('div');
  personWrap.className = 'filter-person-groups';

  for (const [category, names] of Object.entries(DIMENSIONS.person.groups)) {
    const sub = document.createElement('div');
    sub.className = 'filter-subgroup';
    const subtitle = document.createElement('div');
    subtitle.className = 'filter-subtitle';
    subtitle.textContent = category;
    sub.appendChild(subtitle);

    const chips = document.createElement('div');
    chips.className = 'filter-chips';
    for (const name of names) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = name;
      btn.dataset.filterKey = 'person';
      btn.addEventListener('click', () => toggleFilter('person', name, btn));
      chips.appendChild(btn);
    }
    sub.appendChild(chips);
    personWrap.appendChild(sub);
  }
  personGroup.appendChild(personWrap);
  container.appendChild(personGroup);

  const configs = [
    { key: 'housingUsage', label: '用房类型', items: housingUsages },
    { key: 'moment', label: '时刻', items: moments },
    { key: 'residential', label: '住宅类型', items: residentials },
    { key: 'event', label: '事件', items: events },
  ];

  for (const cfg of configs) {
    const group = document.createElement('div');
    group.className = 'filter-group';
    group.innerHTML = `<label>${cfg.label}</label><div class="filter-chips" data-key="${cfg.key}"></div>`;
    container.appendChild(group);
    const chips = group.querySelector('.filter-chips');
    for (const item of cfg.items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = item;
      btn.addEventListener('click', () => toggleFilter(cfg.key, item, btn));
      chips.appendChild(btn);
    }
  }
}

function toggleFilter(key, value, btn) {
  const arr = state.filters[key];
  const idx = arr.indexOf(value);
  if (idx >= 0) {
    arr.splice(idx, 1);
    btn.classList.remove('active');
  } else {
    arr.push(value);
    btn.classList.add('active');
  }
  state.page = 0;
  state.expandedId = null;
  render();
}

function bindEvents() {
  let searchTimer;
  el.search.addEventListener('input', (e) => {
    state.filters.search = e.target.value.trim();
    state.page = 0;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => render(), 300);
  });

  el.showAllToggle.addEventListener('change', (e) => {
    state.showAll = e.target.checked;
    state.minRelevance = state.showAll ? 0 : parseInt(el.minRelevance.value, 10);
    state.page = 0;
    render();
  });

  el.minRelevance.addEventListener('input', (e) => {
    if (state.showAll) return;
    state.minRelevance = parseInt(e.target.value, 10);
    el.relevanceVal.textContent = state.minRelevance;
    state.page = 0;
    render();
  });

  el.btnReset.addEventListener('click', resetFilters);
  el.btnPrev.addEventListener('click', () => {
    if (state.page > 0) {
      state.page--;
      state.expandedId = null;
      render();
    }
  });
  el.btnNext.addEventListener('click', () => {
    state.page++;
    state.expandedId = null;
    render();
  });

  el.btnGoPage.addEventListener('click', () => goToPage(el.pageInput.value));
  el.pageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToPage(el.pageInput.value);
    }
  });
}

function getTotalPages() {
  return Math.max(1, Math.ceil(state.total / PAGE_SIZE));
}

function goToPage(inputVal) {
  const totalPages = getTotalPages();
  const target = parseInt(inputVal, 10);
  if (Number.isNaN(target) || target < 1 || target > totalPages) {
    el.pageInput.value = state.page + 1;
    el.pageInput.classList.add('page-input-error');
    setTimeout(() => el.pageInput.classList.remove('page-input-error'), 600);
    return;
  }
  const newPage = target - 1;
  if (newPage !== state.page) {
    state.page = newPage;
    state.expandedId = null;
    render();
  }
}

function resetFilters() {
  state.filters = {
    person: [], housingUsage: [], moment: [],
    residential: [], event: [], search: '',
  };
  state.page = 0;
  state.expandedId = null;
  state.showAll = false;
  state.minRelevance = 40;
  el.showAllToggle.checked = false;
  el.minRelevance.value = 40;
  el.relevanceVal.textContent = '40';
  el.search.value = '';
  document.querySelectorAll('.chip.active').forEach((c) => c.classList.remove('active'));
  render();
}

function relevanceClass(score) {
  if (score >= 70) return 'rel-high';
  if (score >= 45) return 'rel-mid';
  return 'rel-low';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function renderCardHeader(s) {
  const pain = s.topPain || '';
  const voiceBadge =
    s.voiceCount > 0
      ? `<span class="voice-badge" title="匹配到 ${s.voiceCount} 条北美用户声音">${s.voiceCount} 条用户声音</span>`
      : '';
  return `
    <div class="relevance-badge ${relevanceClass(s.relevance)}" title="关联度">${s.relevance}</div>
    <div class="card-main">
      <div class="card-title-row">
        <div class="card-title">${escapeHtml(s.title)}</div>
        ${voiceBadge}
      </div>
      ${pain ? `<div class="card-top-pain" title="${escapeHtml(pain)}"><span class="pain-dot"></span><span class="pain-label">可能问题</span><span class="pain-text">${escapeHtml(pain)}</span></div>` : ''}
    </div>
    <span class="card-id">${s.id}</span>
    <span class="chevron">▼</span>
  `;
}

function renderCardDetail(full) {
  const j = full.journey;

  const goalsHtml = (j.goals || []).map((g) => `<li>${escapeHtml(g)}</li>`).join('');

  const stepsHtml = (j.journey?.steps || [])
    .map(
      (st, i) => `
      <div class="journey-step">
        <div class="step-num">${i + 1}</div>
        <div class="step-content">
          <div class="step-row"><span class="step-label">行为</span>${escapeHtml(st.action)}</div>
          <div class="step-row"><span class="step-label">触点</span>${escapeHtml(st.touchpoint)}</div>
          <div class="step-row step-thought"><span class="step-label">内心</span>「${escapeHtml(st.thought)}」</div>
          <div class="step-row step-friction"><span class="step-label">麻烦点</span>${escapeHtml(st.friction)}</div>
        </div>
      </div>`
    )
    .join('');

  const beforeHtml = j.before
    ? `<div class="adj-step"><span class="adj-label">前一步 · ${escapeHtml(j.before.label)}</span>${escapeHtml(j.before.brief)}</div>`
    : '<div class="adj-step adj-empty">无（当前为旅程起点）</div>';

  const afterHtml = j.after
    ? `<div class="adj-step"><span class="adj-label">后一步 · ${escapeHtml(j.after.label)}</span>${escapeHtml(j.after.brief)}</div>`
    : '<div class="adj-step adj-empty">无（当前为旅程终点）</div>';

  const pains = (j.painPoints || full.painPoints || []).map((pt) => `<li>${escapeHtml(pt)}</li>`).join('');

  const voicesHtml = (full.userVoices || [])
    .map(
      (v) => `
      <div class="voice-card">
        <blockquote class="voice-quote">"${escapeHtml(v.quoteZh)}"</blockquote>
        <p class="voice-original">${escapeHtml(v.quote)}</p>
        <div class="voice-meta">
          <span class="voice-level">${escapeHtml(evidenceLabel(v.evidenceLevel))}</span>
          <span class="voice-source">${escapeHtml(v.source.label)}</span>
          ${v.source.url ? `<a class="voice-link" href="${escapeHtml(v.source.url)}" target="_blank" rel="noopener">来源</a>` : ''}
        </div>
        <p class="voice-hint"><span>→ 能力方向</span>${escapeHtml(v.capabilityHint)}</p>
      </div>`
    )
    .join('');

  const capHtml = (full.capabilityHints || [])
    .map(
      (c) => `<span class="cap-chip" title="匹配主题: ${escapeHtml(c.overlap.join(', '))}">${escapeHtml(c.name)}</span>`
    )
    .join('');

  const emo = j.emotion || { label: '—', reason: '' };

  return `
    <div class="card-meta">
      <span>${full.person.group} · ${full.person.name}</span>
      <span>${full.residential} / ${full.housingUsage}</span>
      <span>${j.focusMoment} · ${full.event}</span>
    </div>
    <div class="detail-sections">
      <div class="detail-section">
        <h4>1. 目标</h4>
        <ul class="goal-list">${goalsHtml}</ul>
      </div>
      <div class="detail-section">
        <h4>2. 用户状态</h4>
        <p class="user-state">${escapeHtml(j.userState || '')}</p>
      </div>
      <div class="detail-section detail-section-full">
        <h4>3. 旅程图 <span class="section-sub">${escapeHtml(j.journey?.label || j.focusMoment)}</span></h4>
        <div class="phase-steps">${stepsHtml}</div>
      </div>
      <div class="detail-section">
        <h4>4. 情绪</h4>
        <p class="emotion-block"><strong>${escapeHtml(emo.label)}</strong><span class="emotion-reason">${escapeHtml(emo.reason)}</span></p>
      </div>
      <div class="detail-section detail-section-full">
        <h4>5. 前一步 / 后一步</h4>
        <div class="adj-steps">${beforeHtml}${afterHtml}</div>
      </div>
      <div class="detail-section">
        <h4>6. 可能痛点</h4>
        <ul class="pain-list">${pains}</ul>
      </div>
      <div class="detail-section detail-section-full">
        <h4>7. 北美用户声音 <span class="section-sub">公开来源 · 非一手访谈</span></h4>
        ${voicesHtml || '<p class="voice-empty">暂无匹配的用户声音条目，可持续补充 user-voice-data.js</p>'}
      </div>
      ${
        capHtml
          ? `<div class="detail-section detail-section-full"><h4>8. 能力域线索 <span class="section-sub">从用户声音归纳 · 通向能力地图 C</span></h4><div class="cap-chips">${capHtml}</div></div>`
          : ''
      }
    </div>
  `;
}

function evidenceLabel(level) {
  const map = {
    forum_quote: '社区原声',
    review_theme: '评价主题',
    survey_stat: '调研数据',
  };
  return map[level] || level;
}

function renderList(items) {
  if (items.length === 0) {
    el.scenarioList.innerHTML =
      '<div class="empty">无匹配场景。尝试降低关联度阈值或勾选「显示全部组合」。</div>';
    return;
  }

  el.scenarioList.innerHTML = items
    .map((s) => {
      const expanded = state.expandedId === s.id;
      let body = '';
      if (expanded) {
        let full = state.cache.get(s.flatIndex);
        if (!full) {
          full = buildScenario(s.flatIndex);
          state.cache.set(s.flatIndex, full);
        }
        body = renderCardDetail(full);
      }
      return `
        <div class="scenario-card ${expanded ? 'expanded' : ''}" data-index="${s.flatIndex}" data-id="${s.id}">
          <div class="card-header">${renderCardHeader(s)}</div>
          <div class="card-body">${body}</div>
        </div>`;
    })
    .join('');

  el.scenarioList.querySelectorAll('.card-header').forEach((header) => {
    header.addEventListener('click', () => {
      const card = header.closest('.scenario-card');
      const id = card.dataset.id;
      const index = parseInt(card.dataset.index, 10);
      state.expandedId = state.expandedId === id ? null : id;
      if (state.expandedId && !state.cache.has(index)) {
        state.cache.set(index, buildScenario(index));
      }
      renderList(items);
    });
  });
}

function renderPagination() {
  const totalPages = getTotalPages();
  if (state.page >= totalPages) state.page = Math.max(0, totalPages - 1);
  el.pageInfo.textContent = `第 ${state.page + 1} / ${totalPages} 页`;
  el.pageInput.max = totalPages;
  el.pageInput.value = state.page + 1;
  el.btnPrev.disabled = state.page === 0;
  el.btnNext.disabled = state.page >= totalPages - 1 || state.total === 0;
}

function render() {
  if (state.cancelQuery) state.cancelQuery();

  const gen = ++state.renderGen;
  const minRel = state.showAll ? 0 : state.minRelevance;

  el.totalFiltered.textContent = '计算中…';
  el.scenarioList.innerHTML = '<div class="loading">正在扫描组合…<br><small>共 8 万种可能，首次约需 1–3 秒</small></div>';

  state.cancelQuery = queryScenariosAsync(
    state.filters,
    minRel,
    state.page,
    PAGE_SIZE,
    (pct) => {
      if (gen !== state.renderGen) return;
      el.scenarioList.innerHTML = `<div class="loading">正在扫描组合… ${pct}%</div>`;
    },
    ({ items, total }) => {
      if (gen !== state.renderGen) return;
      state.total = total;
      el.totalFiltered.textContent = total.toLocaleString();
      renderList(items);
      renderPagination();
    }
  );
}

init();
