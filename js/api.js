const API = (() => {
  const LS = {
    FOODS:    'nutripro_foods',
    LOGS:     'nutripro_logs',
    BODY:     'nutripro_body',
    SETTINGS: 'nutripro_settings',
  };

  let syncing = false;

  // ── 同步狀態 UI ──────────────────────────────────────────
  function setSyncStatus(state) {
    const dot  = document.querySelector('.sync-dot');
    const text = document.querySelector('.sync-text');
    if (!dot || !text) return;
    dot.className = 'sync-dot';
    if (state === 'ok')      { dot.classList.add('');        text.textContent = '已連線'; }
    if (state === 'loading') { dot.classList.add('loading'); text.textContent = '同步中...'; }
    if (state === 'error')   { dot.classList.add('error');   text.textContent = '離線模式'; }
  }

  // ── 通用 GAS 請求 ─────────────────────────────────────────
  async function gasGet(params) {
    if (!CONFIG.USE_CLOUD) throw new Error('offline');
    const url = CONFIG.GAS_URL + '?' + new URLSearchParams(params);
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function gasPost(body) {
    if (!CONFIG.USE_CLOUD) throw new Error('offline');
    const res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  // ── LS 快取工具 ───────────────────────────────────────────
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.warn('LS write fail', e); }
  }

  // ════════════════════════════════════════════════════════
  //  FOODS
  // ════════════════════════════════════════════════════════
  async function getFoods() {
    try {
      setSyncStatus('loading');
      const data = await gasGet({ action: 'getFoods' });
      // 轉換欄位名稱（sheets 回傳原始欄位名）
      const foods = data.map(normFood);
      lsSet(LS.FOODS, foods);
      setSyncStatus('ok');
      return foods;
    } catch(e) {
      setSyncStatus('error');
      console.warn('getFoods fallback to LS:', e.message);
      return lsGet(LS.FOODS) || [];
    }
  }

  async function addFood(food) {
    const res = await gasPost({ action: 'addFood', food });
    food.id = res.id;
    // 更新本地快取
    const foods = lsGet(LS.FOODS) || [];
    foods.push(food);
    lsSet(LS.FOODS, foods);
    return res;
  }

  async function updateFood(food) {
    const res = await gasPost({ action: 'updateFood', food });
    const foods = lsGet(LS.FOODS) || [];
    const idx = foods.findIndex(f => f.id === food.id);
    if (idx >= 0) { foods[idx] = food; lsSet(LS.FOODS, foods); }
    return res;
  }

  async function deleteFood(id) {
    const res = await gasPost({ action: 'deleteFood', id });
    const foods = (lsGet(LS.FOODS) || []).filter(f => f.id !== id);
    lsSet(LS.FOODS, foods);
    return res;
  }

  // ════════════════════════════════════════════════════════
  //  DIET LOGS
  // ════════════════════════════════════════════════════════
  async function getLogsForDate(date) {
    try {
      setSyncStatus('loading');
      const data = await gasGet({ action: 'getLogs', date });
      const logs = data.map(normLog);
      // 合併到本地快取
      const all = lsGet(LS.LOGS) || {};
      all[date] = logs;
      lsSet(LS.LOGS, all);
      setSyncStatus('ok');
      return logs;
    } catch(e) {
      setSyncStatus('error');
      const all = lsGet(LS.LOGS) || {};
      return all[date] || [];
    }
  }

  async function getLogRange(start, end) {
    try {
      const data = await gasGet({ action: 'getLogRange', start, end });
      return data.map(normLog);
    } catch(e) {
      // 從本地拼湊
      const all = lsGet(LS.LOGS) || {};
      const result = [];
      Object.entries(all).forEach(([date, logs]) => {
        if (date >= start && date <= end) result.push(...logs);
      });
      return result;
    }
  }

  async function saveLog(log) {
    try {
      const res = await gasPost({ action: 'saveLog', log });
      log.id = res.id;
    } catch(e) {
      // 離線：生成本地 id
      if (!log.id) log.id = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    }
    // 始終寫入本地快取
    const all = lsGet(LS.LOGS) || {};
    if (!all[log.date]) all[log.date] = [];
    const idx = all[log.date].findIndex(l => l.id === log.id);
    if (idx >= 0) all[log.date][idx] = log;
    else all[log.date].push(log);
    lsSet(LS.LOGS, all);
    return log;
  }

  async function deleteLog(id, date) {
    try { await gasPost({ action: 'deleteLog', id }); } catch(e) {}
    const all = lsGet(LS.LOGS) || {};
    if (all[date]) { all[date] = all[date].filter(l => l.id !== id); lsSet(LS.LOGS, all); }
  }

  // ════════════════════════════════════════════════════════
  //  BODY STATS
  // ════════════════════════════════════════════════════════
  async function getBodyStats() {
    try {
      const data = await gasGet({ action: 'getBodyStats' });
      const stats = data.map(r => ({
        id: r.id, date: r.date,
        weight: +r.weight, fatPct: +r.fatPct, musclePct: +r.musclePct,
        height: +r.height, age: +r.age, note: r.note,
      }));
      lsSet(LS.BODY, stats);
      return stats;
    } catch(e) {
      return lsGet(LS.BODY) || [];
    }
  }

  async function saveBodyStat(stat) {
    try {
      const res = await gasPost({ action: 'saveBodyStat', stat });
      stat.id = res.id;
    } catch(e) {
      if (!stat.id) stat.id = 'local_' + Date.now();
    }
    const all = lsGet(LS.BODY) || [];
    all.push(stat);
    lsSet(LS.BODY, all);
    return stat;
  }

  // ════════════════════════════════════════════════════════
  //  SETTINGS
  // ════════════════════════════════════════════════════════
  async function getSettings() {
    try {
      const data = await gasGet({ action: 'getSettings' });
      lsSet(LS.SETTINGS, data);
      return data;
    } catch(e) {
      return lsGet(LS.SETTINGS) || {};
    }
  }

  async function saveSettings(settings) {
    lsSet(LS.SETTINGS, { ...(lsGet(LS.SETTINGS) || {}), ...settings });
    try { await gasPost({ action: 'saveSettings', settings }); } catch(e) {}
  }

  // ── 資料正規化 ────────────────────────────────────────────
  function normFood(r) {
    return {
      id: r.id, name: r.name, unit: r.unit,
      kcal: +r.kcal, protein: +r.protein, carb: +r.carb,
      fiber: +r.fiber, fat: +r.fat, category: r.category,
    };
  }
  function normLog(r) {
    return {
      id: r.id, date: r.date, meal: r.meal,
      foodId: r.foodId, foodName: r.foodName,
      qty: +r.qty, kcal: +r.kcal, protein: +r.protein,
      carb: +r.carb, fat: +r.fat, water: +r.water || 0,
    };
  }

  return {
    getFoods, addFood, updateFood, deleteFood,
    getLogsForDate, getLogRange, saveLog, deleteLog,
    getBodyStats, saveBodyStat,
    getSettings, saveSettings,
    lsGet, lsSet, LS,
  };
})();
