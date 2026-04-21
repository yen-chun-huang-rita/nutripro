let STATE = {
  foods: [],
  logs: {},         // { 'YYYY-MM-DD': [log, ...] }
  bodyStats: [],
  settings: {},
  currentDate: todayStr(),
  water: 0,
  activeTag: '全部',
  editingFoodId: null,
  target: { ...CONFIG.TARGET },
  body: { ...CONFIG.BODY },
  goal: { ...CONFIG.GOAL },
  headerColor: CONFIG.HEADER_COLORS[0],
};

let CHARTS = {};

// ── 初始化 ────────────────────────────────────────────────────
async function init() {
  setHeaderDate();
  setupTabs();
  setupColorPicker();
  setupDatePicker();

  // 載入雲端資料
  showToast('正在同步資料...', 'info', 2000);

  try {
    const [foods, settings, bodyStats] = await Promise.all([
      API.getFoods(),
      API.getSettings(),
      API.getBodyStats(),
    ]);

    STATE.foods = foods.length > 0 ? foods : getBuiltinFoods();
    STATE.bodyStats = bodyStats;

    // 套用設定
    applySettings(settings);

    // 載入今日記錄
    await loadLogsForDate();

    renderAll();
    showToast('資料同步完成', 'success');
  } catch(e) {
    // 離線模式：從快取載入
    const cached = API.lsGet(API.LS.FOODS);
    STATE.foods = (cached && cached.length > 0) ? cached : getBuiltinFoods();
    const cachedBody = API.lsGet(API.LS.BODY);
    STATE.bodyStats = cachedBody || [];
    const cachedSettings = API.lsGet(API.LS.SETTINGS);
    applySettings(cachedSettings || {});
    loadLogsFromLS();
    renderAll();
    showToast('已切換為離線模式', 'error');
  }
}

function applySettings(s) {
  if (!s) return;
  if (s.headerColor)   { STATE.headerColor = s.headerColor; applyHeaderColor(s.headerColor); }
  if (s.targetKcal)    STATE.target.kcal    = +s.targetKcal;
  if (s.targetProtein) STATE.target.protein = +s.targetProtein;
  if (s.targetCarb)    STATE.target.carb    = +s.targetCarb;
  if (s.targetFat)     STATE.target.fat     = +s.targetFat;
  if (s.targetWater)   STATE.target.water   = +s.targetWater;
  if (s.bodyHeight)    STATE.body.height    = +s.bodyHeight;
  if (s.bodyWeight)    STATE.body.weight    = +s.bodyWeight;
  if (s.bodyAge)       STATE.body.age       = +s.bodyAge;
  if (s.bodyFatPct)    STATE.body.fatPct    = +s.bodyFatPct;
  if (s.bodyMusclePct) STATE.body.musclePct = +s.bodyMusclePct;
  if (s.bodyActivity)  STATE.body.activity  = +s.bodyActivity;
  if (s.goalWeight)    STATE.goal.weight    = +s.goalWeight;
  if (s.goalFatPct)    STATE.goal.fatPct    = +s.goalFatPct;
  if (s.goalMusclePct) STATE.goal.musclePct = +s.goalMusclePct;
  if (s.water)         STATE.water          = +s.water;
}

function renderAll() {
  renderFoodTable();
  renderMeals();
  calcStats();
  renderDashboard();
}

// ── TABS ──────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
      if (tab === 'dashboard') renderDashboard();
      if (tab === 'stats')     { renderStatsForm(); calcStats(); }
    });
  });
}

// ── DATE / TIME ────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function setHeaderDate() {
  const d = new Date();
  const opts = { year:'numeric', month:'long', day:'numeric', weekday:'long' };
  document.getElementById('headerDate').textContent = d.toLocaleDateString('zh-TW', opts);
}
function setupDatePicker() {
  const inp = document.getElementById('logDate');
  inp.value = STATE.currentDate;
  // Set max to today
  inp.max = todayStr();
}

window.loadLogsForDate = async function() {
  const dateInp = document.getElementById('logDate');
  if (dateInp) STATE.currentDate = dateInp.value;
  const logs = await API.getLogsForDate(STATE.currentDate);
  if (!STATE.logs[STATE.currentDate]) STATE.logs[STATE.currentDate] = [];
  STATE.logs[STATE.currentDate] = logs;
  // Restore water from logs
  const waterLog = logs.find(l => l.meal === '__water__');
  STATE.water = waterLog ? waterLog.water : 0;
  renderMeals();
  updateWaterUI();
};

function loadLogsFromLS() {
  const all = API.lsGet(API.LS.LOGS) || {};
  STATE.logs = all;
  const todayLogs = all[STATE.currentDate] || [];
  const waterLog = todayLogs.find(l => l.meal === '__water__');
  STATE.water = waterLog ? waterLog.water : 0;
}

// ── COLOR PICKER ──────────────────────────────────────────────
function setupColorPicker() {
  const btn     = document.getElementById('colorPickerBtn');
  const palette = document.getElementById('colorPalette');

  // 生成色板
  CONFIG.HEADER_COLORS.forEach((color, i) => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (i === 0 ? ' active' : '');
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener('click', () => {
      selectColor(color);
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      palette.classList.remove('open');
    });
    palette.appendChild(sw);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    palette.classList.toggle('open');
  });
  document.addEventListener('click', () => palette.classList.remove('open'));
  palette.addEventListener('click', e => e.stopPropagation());
}

function selectColor(color) {
  STATE.headerColor = color;
  applyHeaderColor(color);
  API.saveSettings({ headerColor: color });
}

function applyHeaderColor(color) {
  document.getElementById('appHeader').style.background = color;
  document.documentElement.style.setProperty('--hue', color);
  // Update active nav tab color to match
  const style = document.getElementById('dynStyle') || (() => {
    const s = document.createElement('style');
    s.id = 'dynStyle';
    document.head.appendChild(s);
    return s;
  })();
  style.textContent = `.nav-tab.active { color: ${color} !important; }`;
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'success' ? ' success' : type === 'error' ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── WATER ─────────────────────────────────────────────────────
window.adjustWater = function(delta) {
  STATE.water = Math.max(0, STATE.water + delta);
  updateWaterUI();
  saveWater();
};

function updateWaterUI() {
  const v = document.getElementById('waterVal');
  const fill = document.getElementById('waterProgFill');
  const tgtLabel = document.getElementById('waterTargetLabel');
  const tgt = STATE.target.water;
  if (v) v.textContent = STATE.water;
  if (fill) fill.style.width = Math.min(100, (STATE.water / tgt) * 100) + '%';
  if (tgtLabel) tgtLabel.textContent = `目標 ${tgt}ml`;
  // Dashboard water
  const wd = document.getElementById('waterDash');
  if (wd) {
    const pct = Math.min(100, (STATE.water / tgt) * 100);
    wd.innerHTML = `<div class="prog-wrap">
      <div class="prog-header"><span class="prog-label">💧 喝水量</span><span>${STATE.water} / ${tgt} ml</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:#1d5c8a"></div></div>
    </div>`;
  }
}

async function saveWater() {
  const date = STATE.currentDate;
  const logs = STATE.logs[date] || [];
  const idx = logs.findIndex(l => l.meal === '__water__');
  const waterLog = {
    id: idx >= 0 ? logs[idx].id : null,
    date, meal: '__water__', foodId: '', foodName: '喝水',
    qty: 0, kcal: 0, protein: 0, carb: 0, fat: 0,
    water: STATE.water,
  };
  const saved = await API.saveLog(waterLog);
  if (idx >= 0) logs[idx] = saved; else logs.push(saved);
  STATE.logs[date] = logs;
}

// ══════════════════════════════════════════════════════════════
//  FOOD DATABASE
// ══════════════════════════════════════════════════════════════
let activeTag = '全部';

function buildFilterBtns() {
  const tags = ['全部', ...new Set(STATE.foods.map(f => f.category))].sort((a, b) => a === '全部' ? -1 : b === '全部' ? 1 : a.localeCompare(b, 'zh-TW'));
  document.getElementById('filterRow').innerHTML = tags.map(t =>
    `<button class="filter-btn${t === activeTag ? ' active' : ''}" onclick="setTag('${t}')">${t}</button>`
  ).join('');
}

window.setTag = function(t) {
  activeTag = t;
  buildFilterBtns();
  filterFood();
};

window.filterFood = function() {
  const q = document.getElementById('foodSearch').value.toLowerCase();
  const data = STATE.foods.filter(f =>
    (activeTag === '全部' || f.category === activeTag) &&
    (f.name.toLowerCase().includes(q) || f.category.includes(q))
  );
  document.getElementById('foodCount').textContent = `${data.length} 項食物`;
  document.getElementById('foodTbody').innerHTML = data.map(f => `
    <tr>
      <td class="ft-name">${f.name}</td>
      <td style="color:var(--ink-faint);font-size:12px">${f.unit}</td>
      <td><span class="kcal-badge">${f.kcal}</span></td>
      <td>${f.protein}g</td>
      <td>${f.carb}g</td>
      <td>${f.fiber}g</td>
      <td>${f.fat}g</td>
      <td><span class="cat-pill cat-${f.category}">${f.category}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon edit" onclick="editFood('${f.id}')" title="編輯">✏️</button>
        <button class="btn-icon del" onclick="confirmDeleteFood('${f.id}','${f.name}')" title="刪除">🗑️</button>
      </div></td>
    </tr>`).join('');
};

function renderFoodTable() {
  buildFilterBtns();
  filterFood();
}

// ── FOOD MODAL ────────────────────────────────────────────────
window.openFoodModal = function(food = null) {
  STATE.editingFoodId = food ? food.id : null;
  document.getElementById('modalTitle').textContent = food ? '編輯食物' : '新增食物';
  document.getElementById('f_name').value     = food ? food.name     : '';
  document.getElementById('f_unit').value     = food ? food.unit     : '100g';
  document.getElementById('f_category').value = food ? food.category : '蛋白質';
  document.getElementById('f_kcal').value     = food ? food.kcal     : '';
  document.getElementById('f_protein').value  = food ? food.protein  : '';
  document.getElementById('f_carb').value     = food ? food.carb     : '';
  document.getElementById('f_fiber').value    = food ? food.fiber    : '';
  document.getElementById('f_fat').value      = food ? food.fat      : '';
  document.getElementById('foodModal').classList.add('open');
  document.getElementById('f_name').focus();
};

window.closeFoodModal = function() {
  document.getElementById('foodModal').classList.remove('open');
};

window.editFood = function(id) {
  const food = STATE.foods.find(f => f.id === id);
  if (food) openFoodModal(food);
};

window.saveFood = async function() {
  const food = {
    id:       STATE.editingFoodId,
    name:     document.getElementById('f_name').value.trim(),
    unit:     document.getElementById('f_unit').value.trim() || '100g',
    category: document.getElementById('f_category').value,
    kcal:     parseFloat(document.getElementById('f_kcal').value)    || 0,
    protein:  parseFloat(document.getElementById('f_protein').value) || 0,
    carb:     parseFloat(document.getElementById('f_carb').value)    || 0,
    fiber:    parseFloat(document.getElementById('f_fiber').value)   || 0,
    fat:      parseFloat(document.getElementById('f_fat').value)     || 0,
  };
  if (!food.name) { showToast('請填寫食物名稱', 'error'); return; }

  try {
    if (food.id) {
      await API.updateFood(food);
      const idx = STATE.foods.findIndex(f => f.id === food.id);
      if (idx >= 0) STATE.foods[idx] = food;
      showToast(`已更新「${food.name}」`, 'success');
    } else {
      const res = await API.addFood(food);
      food.id = res.id;
      STATE.foods.push(food);
      showToast(`已新增「${food.name}」`, 'success');
    }
    closeFoodModal();
    renderFoodTable();
  } catch(e) {
    showToast('儲存失敗：' + e.message, 'error');
  }
};

window.confirmDeleteFood = function(id, name) {
  document.getElementById('confirmMsg').textContent = `確定要刪除「${name}」嗎？`;
  const modal = document.getElementById('confirmModal');
  modal.classList.add('open');
  document.getElementById('confirmOkBtn').onclick = async () => {
    try {
      await API.deleteFood(id);
      STATE.foods = STATE.foods.filter(f => f.id !== id);
      renderFoodTable();
      showToast(`已刪除「${name}」`, 'success');
    } catch(e) {
      showToast('刪除失敗：' + e.message, 'error');
    }
    closeConfirm();
  };
};

window.closeConfirm = function() {
  document.getElementById('confirmModal').classList.remove('open');
};

// ══════════════════════════════════════════════════════════════
//  MEAL LOGGER
// ══════════════════════════════════════════════════════════════
function getTodayLogs() {
  return (STATE.logs[STATE.currentDate] || []).filter(l => l.meal !== '__water__');
}

function getMealLogs(meal) {
  return getTodayLogs().filter(l => l.meal === meal);
}

function calcTotals(logs) {
  return logs.reduce((t, l) => ({
    kcal: t.kcal + l.kcal, protein: t.protein + l.protein,
    carb: t.carb + l.carb, fat: t.fat + l.fat,
  }), { kcal: 0, protein: 0, carb: 0, fat: 0 });
}

function renderMeals() {
  updateWaterUI();
  const badge = document.getElementById('savingBadge');
  const container = document.getElementById('mealSections');
  if (!container) return;

  container.innerHTML = CONFIG.MEALS.map(meal => {
    const mLogs = getMealLogs(meal);
    const mt = calcTotals(mLogs);

    const rows = mLogs.map((log, i) => `
      <div class="log-item">
        <div>
          <div class="log-food-name">${log.foodName}</div>
          <div class="log-food-qty">${log.qty}g/ml</div>
        </div>
        <div class="log-macro">${log.protein.toFixed(1)}g</div>
        <div class="log-macro">${log.carb.toFixed(1)}g</div>
        <div class="log-macro">${log.fat.toFixed(1)}g</div>
        <div class="log-kcal">${Math.round(log.kcal)}</div>
        <button class="del-btn" onclick="removeLog('${log.id}','${meal}')">✕</button>
      </div>`).join('');

    return `<div class="meal-section">
      <div class="meal-header">
        <span class="meal-name">${meal}</span>
        <span class="meal-stat">${Math.round(mt.kcal)} kcal ∙ 蛋白${mt.protein.toFixed(0)}g ∙ 碳水${mt.carb.toFixed(0)}g ∙ 脂肪${mt.fat.toFixed(0)}g</span>
      </div>
      <div class="log-cols">
        <span class="log-col-h">食物</span>
        <span class="log-col-h">蛋白質</span>
        <span class="log-col-h">碳水</span>
        <span class="log-col-h">脂肪</span>
        <span class="log-col-h">熱量</span>
        <span></span>
      </div>
      ${rows || '<div style="padding:6px 14px;font-size:12px;color:var(--ink-faint)">尚未記錄</div>'}
      <div class="add-row">
        <div class="autocomplete-wrap" id="ac-wrap-${meal}">
          <input class="add-input" id="ac-input-${meal}" type="text" placeholder="輸入食物名稱搜尋..."
            oninput="onAcInput('${meal}')" onkeydown="onAcKey(event,'${meal}')">
          <div class="autocomplete-list" id="ac-list-${meal}"></div>
        </div>
        <input class="add-input" id="qty-${meal}" type="number" value="100" min="1" placeholder="克/ml">
        <span style="font-size:12px;color:var(--ink-faint);align-self:center">g/ml</span>
        <button class="btn-primary" onclick="addLog('${meal}')">＋ 新增</button>
      </div>
    </div>`;
  }).join('');

  renderTotals();
  renderMealProgress();
}

// Autocomplete
let acSelected = {}; // meal -> selected food obj

window.onAcInput = function(meal) {
  const q = document.getElementById('ac-input-' + meal).value.trim().toLowerCase();
  const list = document.getElementById('ac-list-' + meal);
  acSelected[meal] = null;
  if (!q) { list.classList.remove('open'); return; }

  const matches = STATE.foods.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { list.classList.remove('open'); return; }

  list.innerHTML = matches.map(f => `
    <div class="ac-item" onclick="selectFood('${meal}','${f.id}')">
      <div class="ac-item-name">${f.name}</div>
      <div class="ac-item-info">${f.unit} ∙ ${f.kcal}kcal ∙ 蛋白${f.protein}g</div>
    </div>`).join('');
  list.classList.add('open');
};

window.selectFood = function(meal, id) {
  const food = STATE.foods.find(f => f.id === id);
  if (!food) return;
  acSelected[meal] = food;
  document.getElementById('ac-input-' + meal).value = food.name;
  document.getElementById('ac-list-' + meal).classList.remove('open');
};

window.onAcKey = function(e, meal) {
  if (e.key === 'Escape') document.getElementById('ac-list-' + meal).classList.remove('open');
  if (e.key === 'Enter')  addLog(meal);
};

// Close autocomplete on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.autocomplete-list').forEach(l => l.classList.remove('open'));
});

window.addLog = async function(meal) {
  const food = acSelected[meal];
  if (!food) { showToast('請先選擇食物', 'error'); return; }
  const qty = parseFloat(document.getElementById('qty-' + meal).value) || 100;
  const r = qty / 100;
  const log = {
    date: STATE.currentDate, meal,
    foodId: food.id, foodName: food.name, qty,
    kcal:    +(food.kcal    * r).toFixed(1),
    protein: +(food.protein * r).toFixed(1),
    carb:    +(food.carb    * r).toFixed(1),
    fat:     +(food.fat     * r).toFixed(1),
    water: 0,
  };
  const badge = document.getElementById('savingBadge');
  if (badge) { badge.style.display = ''; badge.textContent = '儲存中...'; }
  try {
    const saved = await API.saveLog(log);
    if (!STATE.logs[STATE.currentDate]) STATE.logs[STATE.currentDate] = [];
    STATE.logs[STATE.currentDate].push(saved);
    acSelected[meal] = null;
    renderMeals();
    showToast(`已新增「${food.name}」`, 'success');
  } catch(e) {
    showToast('新增失敗：' + e.message, 'error');
  } finally {
    if (badge) badge.style.display = 'none';
  }
};

window.removeLog = async function(id, meal) {
  await API.deleteLog(id, STATE.currentDate);
  if (STATE.logs[STATE.currentDate])
    STATE.logs[STATE.currentDate] = STATE.logs[STATE.currentDate].filter(l => l.id !== id);
  renderMeals();
  showToast('已刪除', 'success');
};

function renderTotals() {
  const tot = calcTotals(getTodayLogs());
  const T = STATE.target;
  const pairs = [
    { label:'熱量',   val:Math.round(tot.kcal),      unit:'kcal', tgt:T.kcal    },
    { label:'蛋白質', val:tot.protein.toFixed(1),     unit:'g',    tgt:T.protein },
    { label:'碳水',   val:tot.carb.toFixed(1),        unit:'g',    tgt:T.carb    },
    { label:'脂肪',   val:tot.fat.toFixed(1),         unit:'g',    tgt:T.fat     },
  ];
  document.getElementById('totalGrid').innerHTML = pairs.map(x => {
    const diff = parseFloat(x.val) - x.tgt;
    const cls = Math.abs(diff) < x.tgt * 0.05 ? 'tv-ok' : diff > 0 ? 'tv-over' : 'tv-under';
    const sign = diff > 0 ? '+' : '';
    return `<div class="total-item">
      <div class="total-num">${x.val}<span class="total-unit"> ${x.unit}</span></div>
      <div class="total-label">${x.label}</div>
      <div class="total-vs ${cls}">目標 ${x.tgt}${x.unit}（${sign}${diff.toFixed(diff > 10 ? 0 : 1)}）</div>
    </div>`;
  }).join('');
}

function renderMealProgress() {
  const tot = calcTotals(getTodayLogs());
  const T = STATE.target;
  const bars = [
    { l:'熱量',   cur:tot.kcal,    tgt:T.kcal,    col:CONFIG.CHART.green   },
    { l:'蛋白質', cur:tot.protein, tgt:T.protein, col:CONFIG.CHART.protein  },
    { l:'碳水',   cur:tot.carb,    tgt:T.carb,    col:CONFIG.CHART.carb     },
    { l:'脂肪',   cur:tot.fat,     tgt:T.fat,     col:CONFIG.CHART.fat      },
  ];
  const el = document.getElementById('mealProgress');
  if (el) el.innerHTML = bars.map(b => {
    const pct = Math.min(100, (b.cur / b.tgt) * 100);
    const over = b.cur > b.tgt * 1.05;
    return `<div class="prog-wrap">
      <div class="prog-header"><span class="prog-label">${b.l}</span><span>${b.cur.toFixed(0)} / ${b.tgt}</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${over ? '#b03a2e' : b.col}"></div></div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════
function renderStatsForm() {
  const B = STATE.body;
  const G = STATE.goal;
  document.getElementById('currentForm').innerHTML = `
    <div class="field-group">
      <label class="field-label">身高 (cm)</label>
      <input class="field-input" id="s_height"   type="number" value="${B.height}"    oninput="calcStats()">
    </div>
    <div class="field-group">
      <label class="field-label">體重 (kg)</label>
      <input class="field-input" id="s_weight"   type="number" value="${B.weight}"    step="0.1" oninput="calcStats()">
    </div>
    <div class="field-group">
      <label class="field-label">年齡</label>
      <input class="field-input" id="s_age"      type="number" value="${B.age}"       oninput="calcStats()">
    </div>
    <div class="field-group">
      <label class="field-label">體脂率 (%)</label>
      <input class="field-input" id="s_fat"      type="number" value="${B.fatPct}"    step="0.1" oninput="calcStats()">
    </div>
    <div class="field-group">
      <label class="field-label">骨骼肌率 (%)</label>
      <input class="field-input" id="s_muscle"   type="number" value="${B.musclePct}" step="0.1" oninput="calcStats()">
    </div>
    <div class="field-group">
      <label class="field-label">活動量</label>
      <select class="field-input" id="s_activity" onchange="calcStats()">
        <option value="1.2"   ${B.activity==1.2   ?'selected':''}>久坐不動</option>
        <option value="1.375" ${B.activity==1.375 ?'selected':''}>輕度活動（每週1-3次）</option>
        <option value="1.45"  ${B.activity==1.45  ?'selected':''}>中度活動（每週3-5次）</option>
        <option value="1.55"  ${B.activity==1.55  ?'selected':''}>高度活動（每週6-7次）</option>
      </select>
    </div>`;

  document.getElementById('goalForm').innerHTML = `
    <div class="field-group">
      <label class="field-label">目標體重 (kg)</label>
      <input class="field-input" id="g_weight"  type="number" value="${G.weight}"    step="0.1" oninput="calcStats()">
    </div>
    <div class="field-group">
      <label class="field-label">目標體脂率 (%)</label>
      <input class="field-input" id="g_fat"     type="number" value="${G.fatPct}"    step="0.1" oninput="calcStats()">
    </div>
    <div class="field-group" style="grid-column:span 2">
      <label class="field-label">目標骨骼肌率 (%)</label>
      <input class="field-input" id="g_muscle"  type="number" value="${G.musclePct}" step="0.1" oninput="calcStats()">
    </div>`;
}

window.calcStats = function() {
  const h  = +document.getElementById('s_height')?.value   || STATE.body.height;
  const w  = +document.getElementById('s_weight')?.value   || STATE.body.weight;
  const a  = +document.getElementById('s_age')?.value      || STATE.body.age;
  const fp = +document.getElementById('s_fat')?.value      || STATE.body.fatPct;
  const mp = +document.getElementById('s_muscle')?.value   || STATE.body.musclePct;
  const act= +document.getElementById('s_activity')?.value || STATE.body.activity;

  const bmr  = Math.round(10 * w + 6.25 * h - 5 * a - 161);
  const tdee = Math.round(bmr * act);
  const rec  = Math.round(tdee - 200);

  // Update state
  STATE.body = { height:h, weight:w, age:a, fatPct:fp, musclePct:mp, activity:act };

  const el = document.getElementById('currentResults');
  if (el) el.innerHTML = [
    ['基礎代謝率 (BMR)',  `${bmr} kcal`],
    ['每日總消耗 (TDEE)', `${tdee} kcal`],
    ['脂肪重量',          `${(w * fp / 100).toFixed(1)} kg`],
    ['骨骼肌重量',        `${(w * mp / 100).toFixed(1)} kg`],
    ['去脂體重',          `${(w * (1 - fp / 100)).toFixed(1)} kg`],
    ['建議每日攝取',      `<span class="res-hl">${rec} kcal</span>`],
  ].map(([l, v]) => `<div class="result-row"><span class="res-label">${l}</span><span class="res-val">${v}</span></div>`).join('');

  const gw  = +document.getElementById('g_weight')?.value  || STATE.goal.weight;
  const gfp = +document.getElementById('g_fat')?.value     || STATE.goal.fatPct;
  const gmp = +document.getElementById('g_muscle')?.value  || STATE.goal.musclePct;

  STATE.goal = { weight:gw, fatPct:gfp, musclePct:gmp };

  const wDiff  = (w - gw).toFixed(1);
  const fDiff  = (fp - gfp).toFixed(1);
  const mDiff  = (gmp - mp).toFixed(1);
  const def90  = Math.round(+wDiff * 7700 / 90);
  const dailyT = Math.round(tdee - def90);

  const el2 = document.getElementById('goalResults');
  if (el2) el2.innerHTML = [
    ['體重變化',       `-${wDiff} kg → ${gw} kg`],
    ['體脂率變化',     `-${fDiff}% → ${gfp}%`],
    ['骨骼肌率增加',   `+${mDiff}% → ${gmp}%`],
    ['每日熱量赤字',   `${def90} kcal`],
    ['90天每日攝取',   `<span class="res-hl">${dailyT} kcal</span>`],
  ].map(([l, v]) => `<div class="result-row"><span class="res-label">${l}</span><span class="res-val">${v}</span></div>`).join('');

  renderCompChart(fp, gfp, mp, gmp);
  renderHistoryChart();
};

window.saveBodyStat = async function() {
  const stat = {
    date: todayStr(),
    weight:    STATE.body.weight,
    fatPct:    STATE.body.fatPct,
    musclePct: STATE.body.musclePct,
    height:    STATE.body.height,
    age:       STATE.body.age,
  };
  try {
    await API.saveBodyStat(stat);
    STATE.bodyStats.push(stat);
    showToast('身體數據已儲存', 'success');
    renderHistoryChart();
  } catch(e) {
    showToast('儲存失敗：' + e.message, 'error');
  }
};

window.saveGoalSettings = async function() {
  const settings = {
    goalWeight:    STATE.goal.weight,
    goalFatPct:    STATE.goal.fatPct,
    goalMusclePct: STATE.goal.musclePct,
    bodyHeight:    STATE.body.height,
    bodyWeight:    STATE.body.weight,
    bodyAge:       STATE.body.age,
    bodyFatPct:    STATE.body.fatPct,
    bodyMusclePct: STATE.body.musclePct,
    bodyActivity:  STATE.body.activity,
  };
  await API.saveSettings(settings);
  showToast('目標設定已儲存', 'success');
};

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
function renderDashboard() {
  const tot  = calcTotals(getTodayLogs());
  const B    = STATE.body;
  const T    = STATE.target;
  const bmr  = Math.round(10 * B.weight + 6.25 * B.height - 5 * B.age - 161);
  const tdee = Math.round(bmr * B.activity);
  const rem  = Math.max(0, T.kcal - tot.kcal);

  // Metric cards
  document.getElementById('dashMetrics').innerHTML = [
    { label:'今日攝取', val:Math.round(tot.kcal), unit:'kcal', sub:`目標 ${T.kcal} kcal`,   cls:'green' },
    { label:'剩餘熱量', val:Math.round(rem),       unit:'kcal', sub:`赤字目標 -200 kcal`,    cls:'amber' },
    { label:'基礎代謝', val:bmr,                   unit:'kcal', sub:`TDEE ${tdee} kcal`,     cls:'blue'  },
    { label:'今日蛋白', val:tot.protein.toFixed(1),unit:'g',    sub:`目標 ${T.protein}g`,    cls:tot.protein >= T.protein ? 'green' : 'red' },
  ].map(x => `<div class="metric-card ${x.cls}">
    <div class="m-label">${x.label}</div>
    <div class="m-value">${x.val}<span class="m-unit"> ${x.unit}</span></div>
    <div class="m-sub">${x.sub}</div>
  </div>`).join('');

  // Kcal doughnut
  renderKcalChart(tot.kcal, T.kcal);
  document.getElementById('kcalCenterVal').textContent = Math.round(tot.kcal);
  document.getElementById('kcalTarget').textContent = T.kcal;
  const badge = document.getElementById('kcalBadge');
  const pct = tot.kcal / T.kcal;
  if (pct > 1.05) { badge.textContent='超標'; badge.className='badge red'; }
  else if (pct >= 0.85) { badge.textContent='正常'; badge.className='badge'; }
  else { badge.textContent='攝取不足'; badge.className='badge amber'; }

  // Macro doughnut
  renderMacroDoughnut(tot);

  // Progress + water
  renderDashProgress(tot);
  updateWaterUI();

  // Body comp
  renderBodyComp();

  // Weight chart
  renderWeightChart();
}

function renderDashProgress(tot) {
  const T = STATE.target;
  const bars = [
    { l:'熱量',   cur:tot.kcal,    tgt:T.kcal,    col:CONFIG.CHART.green   },
    { l:'蛋白質', cur:tot.protein, tgt:T.protein, col:CONFIG.CHART.protein  },
    { l:'碳水',   cur:tot.carb,    tgt:T.carb,    col:CONFIG.CHART.carb     },
    { l:'脂肪',   cur:tot.fat,     tgt:T.fat,     col:CONFIG.CHART.fat      },
  ];
  const el = document.getElementById('dashProgress');
  if (el) el.innerHTML = bars.map(b => {
    const pct = Math.min(100, (b.cur / b.tgt) * 100);
    const over = b.cur > b.tgt * 1.05;
    return `<div class="prog-wrap">
      <div class="prog-header"><span class="prog-label">${b.l}</span><span>${b.cur.toFixed(0)} / ${b.tgt}</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${over ? '#b03a2e' : b.col}"></div></div>
    </div>`;
  }).join('');
}

function renderBodyComp() {
  const B = STATE.body;
  const other = Math.max(0, 100 - B.fatPct - B.musclePct - 4);
  document.getElementById('bodyCompViz').innerHTML = `
    <div class="bv-bar-wrap">
      <div class="bv-seg seg-fat"    style="width:${B.fatPct}%"></div>
      <div class="bv-seg seg-muscle" style="width:${B.musclePct}%"></div>
      <div class="bv-seg seg-bone"   style="width:4%"></div>
      <div class="bv-seg seg-other"  style="width:${other}%"></div>
    </div>
    <div class="bv-legend">
      <div class="bv-leg"><div class="bv-dot" style="background:#e87070"></div>體脂 ${B.fatPct}%</div>
      <div class="bv-leg"><div class="bv-dot" style="background:var(--green-l)"></div>骨骼肌 ${B.musclePct}%</div>
      <div class="bv-leg"><div class="bv-dot" style="background:var(--gold)"></div>骨骼 ~4%</div>
      <div class="bv-leg"><div class="bv-dot" style="background:var(--border)"></div>其他 ${other.toFixed(1)}%</div>
    </div>`;

  const tot = calcTotals(getTodayLogs());
  document.getElementById('bodyStatus').innerHTML = [
    { label:'體重',       val:`${B.weight} kg`,           dot: 'sd-g', target:`目標 ${STATE.goal.weight} kg` },
    { label:'體脂率',     val:`${B.fatPct}%`,             dot: B.fatPct > 25 ? 'sd-r' : 'sd-a', target:`目標 ${STATE.goal.fatPct}%` },
    { label:'骨骼肌率',   val:`${B.musclePct}%`,          dot: B.musclePct < 28 ? 'sd-a' : 'sd-g', target:`目標 ${STATE.goal.musclePct}%` },
    { label:'今日蛋白質', val:`${tot.protein.toFixed(0)}g`, dot: tot.protein >= STATE.target.protein ? 'sd-g' : 'sd-a', target:`目標 ${STATE.target.protein}g` },
  ].map(x => `<div class="status-row">
    <div class="s-dot ${x.dot}"></div>
    <div class="s-label">${x.label}</div>
    <div class="s-val">${x.val}<span class="s-tgt">${x.target}</span></div>
  </div>`).join('');
}

// ── CHARTS ────────────────────────────────────────────────────
function destroyChart(key) {
  if (CHARTS[key]) { CHARTS[key].destroy(); delete CHARTS[key]; }
}

function renderKcalChart(eaten, total) {
  destroyChart('kcal');
  const left = Math.max(0, total - eaten);
  CHARTS.kcal = new Chart(document.getElementById('kcalChart'), {
    type: 'doughnut',
    data: {
      labels: ['已攝取', '剩餘'],
      datasets: [{ data: [Math.round(eaten), Math.round(left)], backgroundColor: ['#2d9e6e', '#e8f5ee'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
  });
}

function renderMacroDoughnut(tot) {
  destroyChart('macro');
  document.getElementById('macroLegend').innerHTML = [
    { l:'蛋白質', c:CONFIG.CHART.protein, v:tot.protein.toFixed(0)+'g' },
    { l:'碳水',   c:CONFIG.CHART.carb,    v:tot.carb.toFixed(0)+'g'    },
    { l:'脂肪',   c:CONFIG.CHART.fat,     v:tot.fat.toFixed(0)+'g'     },
  ].map(x => `<div class="ml-item"><div class="ml-sq" style="background:${x.c}"></div>${x.l} ${x.v}</div>`).join('');

  CHARTS.macro = new Chart(document.getElementById('macroChart'), {
    type: 'doughnut',
    data: {
      labels: ['蛋白質', '碳水', '脂肪'],
      datasets: [{ data: [+(tot.protein*4).toFixed(0)||1, +(tot.carb*4).toFixed(0)||1, +(tot.fat*9).toFixed(0)||1], backgroundColor: [CONFIG.CHART.protein, CONFIG.CHART.carb, CONFIG.CHART.fat], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false } } }
  });
}

function renderWeightChart() {
  destroyChart('weight');
  const stats = STATE.bodyStats.slice(-14);
  const labels = stats.map(s => s.date);
  const data   = stats.map(s => +s.weight);
  // Fallback demo data
  const fLabels = labels.length > 1 ? labels : ['Day1','Day2','Day3','Day4','Day5','Day6','今天'];
  const fData   = data.length   > 1 ? data   : [48.4, 48.3, 48.5, 48.2, 48.3, 48.1, 48.4];

  CHARTS.weight = new Chart(document.getElementById('weightChart'), {
    type: 'line',
    data: {
      labels: fLabels,
      datasets: [{
        label: '體重', data: fData,
        borderColor: CONFIG.CHART.green, backgroundColor: CONFIG.CHART.greenPale,
        tension: 0.45, fill: true, pointRadius: 4,
        pointBackgroundColor: CONFIG.CHART.green, pointBorderColor: '#fff', pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: v => v + 'kg' }, grid: { color: 'rgba(0,0,0,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderCompChart(cf, gf, cm, gm) {
  destroyChart('comp');
  CHARTS.comp = new Chart(document.getElementById('compChart'), {
    type: 'bar',
    data: {
      labels: ['體脂率', '骨骼肌率', '水分+其他'],
      datasets: [
        { label:'目前', data:[cf, cm, +(100-cf-cm).toFixed(1)], backgroundColor:['#e87070', '#2d9e6e', '#aab8aa'] },
        { label:'目標', data:[gf, gm, +(100-gf-gm).toFixed(1)], backgroundColor:['#f5c0bb', '#c3e8d4', '#dde8dd'] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 12 }, usePointStyle: true } } },
      scales: { y: { max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
    }
  });
}

function renderHistoryChart() {
  destroyChart('history');
  const el = document.getElementById('historyChart');
  if (!el) return;
  const stats = STATE.bodyStats.slice(-30);
  CHARTS.history = new Chart(el, {
    type: 'line',
    data: {
      labels: stats.map(s => s.date),
      datasets: [
        { label:'體重(kg)', data:stats.map(s=>+s.weight), borderColor:'#2d9e6e', backgroundColor:'rgba(45,158,110,.08)', yAxisID:'y', tension:.4, fill:true },
        { label:'體脂率(%)', data:stats.map(s=>+s.fatPct), borderColor:'#e87070', backgroundColor:'transparent', yAxisID:'y2', tension:.4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom', labels: { font:{size:12}, usePointStyle:true } } },
      scales: {
        y:  { position:'left',  ticks:{callback:v=>v+'kg'}, grid:{color:'rgba(0,0,0,0.04)'} },
        y2: { position:'right', ticks:{callback:v=>v+'%'},  grid:{display:false} },
        x:  { grid:{display:false} }
      }
    }
  });
}

// ── 內建食物資料（離線備援）────────────────────────────────────
function getBuiltinFoods() {
  return [
    {id:'b1',name:'生豆皮',unit:'100g',kcal:166,protein:25,carb:3,fiber:0.1,fat:6,category:'蛋白質'},
    {id:'b2',name:'板豆腐',unit:'100g',kcal:67,protein:7,carb:2,fiber:0.3,fat:3.5,category:'蛋白質'},
    {id:'b3',name:'嫩豆腐',unit:'100g',kcal:55,protein:5,carb:2.5,fiber:0.2,fat:2.7,category:'蛋白質'},
    {id:'b4',name:'天貝',unit:'100g',kcal:193,protein:19,carb:9,fiber:4.6,fat:11,category:'蛋白質'},
    {id:'b5',name:'雞蛋',unit:'1顆50g',kcal:72,protein:6,carb:0.3,fiber:0,fat:5,category:'蛋白質'},
    {id:'b6',name:'毛豆（熟）',unit:'100g',kcal:122,protein:11,carb:10,fiber:4.2,fat:5,category:'豆類'},
    {id:'b7',name:'黑豆（熟）',unit:'100g',kcal:132,protein:8.9,carb:23,fiber:7.5,fat:0.5,category:'豆類'},
    {id:'b8',name:'鷹嘴豆（熟）',unit:'100g',kcal:164,protein:8.9,carb:27,fiber:7.6,fat:2.6,category:'豆類'},
    {id:'b9',name:'無糖豆漿',unit:'100ml',kcal:38,protein:3.5,carb:2.5,fiber:0.3,fat:1.8,category:'飲品'},
    {id:'b10',name:'希臘優格（無糖）',unit:'100g',kcal:59,protein:8.5,carb:4,fiber:0,fat:0.5,category:'乳製品'},
    {id:'b11',name:'燕麥片',unit:'100g',kcal:389,protein:13,carb:66,fiber:10.6,fat:7,category:'全穀'},
    {id:'b12',name:'糙米（熟）',unit:'100g',kcal:111,protein:2.6,carb:23,fiber:1.8,fat:0.9,category:'全穀'},
    {id:'b13',name:'藜麥（熟）',unit:'100g',kcal:120,protein:4,carb:21,fiber:2.8,fat:1.9,category:'全穀'},
    {id:'b14',name:'地瓜（熟）',unit:'100g',kcal:86,protein:1.6,carb:20,fiber:3,fat:0.1,category:'全穀'},
    {id:'b15',name:'花椰菜',unit:'100g',kcal:34,protein:2.8,carb:5,fiber:2.6,fat:0.4,category:'蔬菜'},
    {id:'b16',name:'菠菜',unit:'100g',kcal:23,protein:2.9,carb:3.6,fiber:2.2,fat:0.4,category:'蔬菜'},
    {id:'b17',name:'番茄',unit:'100g',kcal:18,protein:0.9,carb:3.9,fiber:1.2,fat:0.2,category:'蔬菜'},
    {id:'b18',name:'香菇（新鮮）',unit:'100g',kcal:22,protein:3.3,carb:3.4,fiber:2.5,fat:0.3,category:'菇類'},
    {id:'b19',name:'藍莓',unit:'100g',kcal:57,protein:0.7,carb:14,fiber:2.4,fat:0.3,category:'水果'},
    {id:'b20',name:'香蕉',unit:'100g',kcal:89,protein:1.1,carb:23,fiber:2.6,fat:0.3,category:'水果'},
    {id:'b21',name:'核桃',unit:'15g',kcal:98,protein:2.3,carb:1,fiber:1,fat:9.8,category:'堅果'},
    {id:'b22',name:'亞麻籽',unit:'10g',kcal:55,protein:1.8,carb:3,fiber:2.8,fat:4.3,category:'堅果'},
    {id:'b23',name:'橄欖油',unit:'10g',kcal:90,protein:0,carb:0,fiber:0,fat:10,category:'油脂'},
    {id:'b24',name:'酪梨',unit:'100g',kcal:160,protein:2,carb:8.5,fiber:6.7,fat:14.7,category:'油脂'},
    {id:'b25',name:'黑咖啡',unit:'250ml',kcal:5,protein:0.3,carb:0.5,fiber:0,fat:0,category:'飲品'},
  ];
}

// ── 啟動 ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Load Chart.js
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
  s.onload = init;
  document.head.appendChild(s);
});
