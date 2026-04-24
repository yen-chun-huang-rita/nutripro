let STATE = {
  foods:[], logs:{}, bodyStats:[], settings:{},
  currentDate: todayStr(), water:0, activeTag:'全部',
  editingFoodId:null,
  target:{...CONFIG.TARGET}, body:{...CONFIG.BODY}, goal:{...CONFIG.GOAL},
  headerColor: CONFIG.HEADER_COLORS[0],
};
let CHARTS = {};

async function init() {
  setHeaderDate(); setupTabs(); setupColorPicker(); setupDatePicker(); renderStatsForm();
  showToast('正在同步資料...','info',2000);
  try {
    const timeout = new Promise((_,reject) => setTimeout(() => reject(new Error('timeout')), 15000));
    const [foods,settings,bodyStats] = await Promise.race([
      Promise.all([API.getFoods(),API.getSettings(),API.getBodyStats()]),
      timeout
    ]);
    STATE.foods = foods.length>0?foods:getBuiltinFoods();
    STATE.bodyStats = bodyStats;
    applySettings(settings);
    await loadLogsForDate();
    renderAll();
    const ss=document.getElementById('syncStatus');
    if(ss){ss.textContent='已連線';}
    showToast('資料同步完成','success');
  } catch(e) {
    const c=API.lsGet(API.LS.FOODS);
    STATE.foods=(c&&c.length>0)?c:getBuiltinFoods();
    STATE.bodyStats=API.lsGet(API.LS.BODY)||[];
    applySettings(API.lsGet(API.LS.SETTINGS)||{});
    loadLogsFromLS(); renderAll();
    const ss=document.getElementById('syncStatus');
    if(ss){ss.textContent='離線模式';}
    showToast('連線失敗，5秒後重試...','error');
    setTimeout(init, 5000);
  }
}

function applySettings(s){
  if(!s)return;
  if(s.headerColor){STATE.headerColor=s.headerColor;applyHeaderColor(s.headerColor);}
  if(s.targetKcal)   STATE.target.kcal    =+s.targetKcal;
  if(s.targetProtein)STATE.target.protein =+s.targetProtein;
  if(s.targetCarb)   STATE.target.carb    =+s.targetCarb;
  if(s.targetFat)    STATE.target.fat     =+s.targetFat;
  if(s.targetWater)  STATE.target.water   =+s.targetWater;
  if(s.bodyHeight)   STATE.body.height    =+s.bodyHeight;
  if(s.bodyWeight)   STATE.body.weight    =+s.bodyWeight;
  if(s.bodyAge)      STATE.body.age       =+s.bodyAge;
  if(s.bodyFatPct)   STATE.body.fatPct    =+s.bodyFatPct;
  if(s.bodyMusclePct)STATE.body.musclePct =+s.bodyMusclePct;
  if(s.bodyActivity) STATE.body.activity  =+s.bodyActivity;
  if(s.goalWeight)   STATE.goal.weight    =+s.goalWeight;
  if(s.goalFatPct)   STATE.goal.fatPct    =+s.goalFatPct;
  if(s.goalMusclePct)STATE.goal.musclePct =+s.goalMusclePct;
  if(s.water)        STATE.water          =+s.water;
}

function renderAll(){renderFoodTable();renderMeals();renderStatsForm();calcStats();renderDashboard();renderBodyStatYearOptions();renderBodyStatTable();}

// ── TABS ──────────────────────────────────────────────────
function setupTabs(){
  document.querySelectorAll('.nav-tab').forEach(btn=>{
    btn.addEventListener('click',function(){
      const tab=this.dataset.tab;
      document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
      this.classList.add('active');
      const panel=document.getElementById('tab-'+tab);
      if(panel) panel.classList.add('active');
      if(tab==='dashboard') renderDashboard();
      if(tab==='stats'){renderStatsForm();calcStats();}
      if(tab==='food') renderFoodTable();
      if(tab==='meal') renderMeals();
    });
  });
}

function todayStr(){return new Date().toISOString().slice(0,10);}

function setHeaderDate(){
  const el=document.getElementById('headerDate');
  if(!el)return;
  el.textContent=new Date().toLocaleDateString('zh-TW',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
}

function setupDatePicker(){
  const inp=document.getElementById('logDate');
  if(!inp)return;
  inp.value=STATE.currentDate; inp.max=todayStr();
}

window.loadLogsForDate=async function(){
  const inp=document.getElementById('logDate');
  if(inp) STATE.currentDate=inp.value;
  try{
    const logs=await API.getLogsForDate(STATE.currentDate);
    STATE.logs[STATE.currentDate]=logs;
    const wl=logs.find(l=>l.meal==='__water__');
    STATE.water=wl?+wl.water:0;
  }catch(e){loadLogsFromLS();}
  renderMeals(); updateWaterUI(); renderDashboard();
};

function loadLogsFromLS(){
  const all=API.lsGet(API.LS.LOGS)||{};
  STATE.logs=all;
  const wl=(all[STATE.currentDate]||[]).find(l=>l.meal==='__water__');
  STATE.water=wl?+wl.water:0;
}

// ── COLOR PICKER ─────────────────────────────────────────
function setupColorPicker(){
  const btn=document.getElementById('colorPickerBtn');
  const palette=document.getElementById('colorPalette');
  if(!btn||!palette)return;
  CONFIG.HEADER_COLORS.forEach(color=>{
    const sw=document.createElement('div');
    sw.className='color-swatch'+(color===STATE.headerColor?' active':'');
    sw.style.background=color; sw.title=color;
    sw.addEventListener('click',()=>{
      selectColor(color);
      palette.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));
      sw.classList.add('active');
      palette.classList.remove('open');
    });
    palette.appendChild(sw);
  });
  btn.addEventListener('click',e=>{e.stopPropagation();palette.classList.toggle('open');});
  document.addEventListener('click',()=>palette.classList.remove('open'));
  palette.addEventListener('click',e=>e.stopPropagation());
  applyHeaderColor(STATE.headerColor);
}

function selectColor(color){
  STATE.headerColor=color; applyHeaderColor(color);
  API.saveSettings({headerColor:color});
}

function applyHeaderColor(color){
  const h=document.getElementById('appHeader');
  if(h) h.style.background=color;
  let s=document.getElementById('dynStyle');
  if(!s){s=document.createElement('style');s.id='dynStyle';document.head.appendChild(s);}
  s.textContent=`.nav-tab.active{color:${color}!important;}`;
}

// ── TOAST ────────────────────────────────────────────────
function showToast(msg,type='info',duration=2500){
  const t=document.getElementById('toast');
  if(!t)return;
  t.textContent=msg;
  t.className='toast show'+(type==='success'?' success':type==='error'?' error':'');
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.remove('show'),duration);
}

// ── WATER ────────────────────────────────────────────────
window.adjustWater=function(delta){STATE.water=Math.max(0,STATE.water+delta);updateWaterUI();saveWater();};

function updateWaterUI(){
  const tgt=STATE.target.water;
  const v=document.getElementById('waterVal'),fill=document.getElementById('waterProgFill'),lbl=document.getElementById('waterTargetLabel');
  if(v)v.textContent=STATE.water;
  if(fill)fill.style.width=Math.min(100,(STATE.water/tgt)*100)+'%';
  if(lbl)lbl.textContent=`目標 ${tgt}ml`;
  const wd=document.getElementById('waterDash');
  if(wd){const pct=Math.min(100,(STATE.water/tgt)*100);wd.innerHTML=`<div class="prog-wrap"><div class="prog-header"><span class="prog-label">💧 喝水量</span><span>${STATE.water} / ${tgt} ml</span></div><div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:#1d5c8a"></div></div></div>`;}
}

async function saveWater(){
  const date=STATE.currentDate;
  if(!STATE.logs[date])STATE.logs[date]=[];
  const logs=STATE.logs[date];
  const idx=logs.findIndex(l=>l.meal==='__water__');
  const wLog={id:idx>=0?logs[idx].id:null,date,meal:'__water__',foodId:'',foodName:'喝水',qty:0,kcal:0,protein:0,carb:0,fat:0,water:STATE.water};
  const saved=await API.saveLog(wLog);
  if(idx>=0)logs[idx]=saved;else logs.push(saved);
}

// ══════════════════════════════════════════════════════════
//  FOOD DATABASE
// ══════════════════════════════════════════════════════════
let activeTag='全部';

function buildFilterBtns(){
  const tags=['全部',...new Set(STATE.foods.map(f=>f.category))].sort((a,b)=>a==='全部'?-1:b==='全部'?1:a.localeCompare(b,'zh-TW'));
  const row=document.getElementById('filterRow');
  if(!row)return;
  row.innerHTML=tags.map(t=>`<button class="filter-btn${t===activeTag?' active':''}" onclick="setTag('${t}')">${t}</button>`).join('');
}

window.setTag=function(t){activeTag=t;buildFilterBtns();filterFood();};

window.filterFood=function(){
  const q=(document.getElementById('foodSearch')?.value||'').toLowerCase();
  const data=STATE.foods.filter(f=>(activeTag==='全部'||f.category===activeTag)&&(f.name.toLowerCase().includes(q)||f.category.includes(q)));
  const cnt=document.getElementById('foodCount');
  if(cnt)cnt.textContent=`${data.length} 項食物`;
  const tbody=document.getElementById('foodTbody');
  if(!tbody)return;
  tbody.innerHTML=data.map(f=>`<tr>
    <td><input type="checkbox" class="food-cb" value="${f.id}" onchange="updateBatchBar()"></td>
    <td class="ft-name">${f.name}</td>
    <td style="color:var(--ink-faint);font-size:14px">${f.unit}</td>
    <td><span class="kcal-badge">${f.kcal}</span></td>
    <td>${f.protein}g</td><td>${f.carb}g</td><td>${f.fiber}g</td><td>${f.fat}g</td>
    <td><span class="cat-pill cat-${f.category}">${f.category}</span></td>
    <td><div class="action-btns">
      <button class="btn-icon edit" onclick="editFood('${f.id}')" title="編輯">✏️</button>
      <button class="btn-icon del"  onclick="confirmDeleteFood('${f.id}','${f.name}')" title="刪除">🗑️</button>
    </div></td>
  </tr>`).join('');
  updateBatchBar();
};

window.toggleSelectAll=function(cb){
  document.querySelectorAll('.food-cb').forEach(c=>c.checked=cb.checked);
  updateBatchBar();
};

window.updateBatchBar=function(){
  const checked=document.querySelectorAll('.food-cb:checked');
  const bar=document.getElementById('batchBar');
  const countEl=document.getElementById('batchCount');
  if(bar) bar.style.display=checked.length>0?'flex':'none';
  if(countEl) countEl.textContent=`已選 ${checked.length} 項`;
};

window.batchDeleteFoods=async function(){
  const checked=[...document.querySelectorAll('.food-cb:checked')];
  if(!checked.length)return;
  const ids=checked.map(c=>c.value);
  const names=ids.map(id=>STATE.foods.find(f=>f.id===id)?.name||id);
  document.getElementById('confirmMsg').textContent=`確定要刪除這 ${ids.length} 項食物嗎？`;
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmOkBtn').onclick=async()=>{
    closeConfirm();
    showToast(`刪除中，共 ${ids.length} 筆...`,'info',10000);
    let done=0;
    for(const id of ids){
      try{
        await API.deleteFood(id);
        STATE.foods=STATE.foods.filter(f=>f.id!==id);
        done++;
      }catch(e){}
    }
    renderFoodTable();
    showToast(`已刪除 ${done} 項食物`,'success');
  };
};

function renderFoodTable(){buildFilterBtns();filterFood();}

// ── 匯出 Excel ──────────────────────────────────────────
window.exportFoods=function(){
  const headers=['名稱','份量單位','熱量(kcal)','蛋白質(g)','碳水(g)','膳食纖維(g)','脂肪(g)','類別'];
  const rows=STATE.foods.map(f=>[f.name,f.unit,f.kcal,f.protein,f.carb,f.fiber,f.fat,f.category]);

  // 組合 CSV（用 BOM 讓 Excel 正確顯示中文）
  const BOM='\uFEFF';
  const csv=BOM+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='NutriPro_食物資料庫_'+todayStr()+'.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`已匯出 ${STATE.foods.length} 筆食物資料`,'success');
};

// ── 匯入 Excel/CSV ───────────────────────────────────────
window.triggerImport=function(){
  document.getElementById('importFileInput').click();
};

window.importFoods=async function(e){
  const file=e.target.files[0];
  if(!file){return;}
  e.target.value=''; // reset so same file can be re-selected

  const text=await file.text();
  // 移除 BOM
  const clean=text.replace(/^\uFEFF/,'');
  const lines=clean.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2){showToast('檔案格式錯誤或無資料','error');return;}

  // 解析 CSV（支援引號包覆）
  function parseCSVLine(line){
    const result=[];let cur='';let inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else{inQ=!inQ;}}
      else if(ch===','&&!inQ){result.push(cur.trim());cur='';}
      else{cur+=ch;}
    }
    result.push(cur.trim());
    return result;
  }

  const header=parseCSVLine(lines[0]).map(h=>h.toLowerCase().replace(/[（(].*[）)]/g,'').trim());
  // 欄位對應（容錯）
  const colMap={
    name:   header.findIndex(h=>h.includes('名稱')||h==='name'),
    unit:   header.findIndex(h=>h.includes('份量')||h.includes('單位')||h==='unit'),
    kcal:   header.findIndex(h=>h.includes('熱量')||h==='kcal'),
    protein:header.findIndex(h=>h.includes('蛋白')||h==='protein'),
    carb:   header.findIndex(h=>h.includes('碳水')||h==='carb'),
    fiber:  header.findIndex(h=>h.includes('纖維')||h==='fiber'),
    fat:    header.findIndex(h=>h.includes('脂肪')||h==='fat'),
    category:header.findIndex(h=>h.includes('類別')||h==='category'),
  };

  if(colMap.name<0||colMap.kcal<0){showToast('找不到必要欄位（名稱、熱量），請確認格式','error');return;}

  let added=0,skipped=0;
  const toAdd=[];
  for(let i=1;i<lines.length;i++){
    const cols=parseCSVLine(lines[i]);
    const name=(cols[colMap.name]||'').trim();
    if(!name){skipped++;continue;}
    // 跳過已存在（同名）
    if(STATE.foods.some(f=>f.name===name)){skipped++;continue;}
    toAdd.push({
      name,
      unit:   colMap.unit>=0?(cols[colMap.unit]||'100g'):'100g',
      kcal:   +(cols[colMap.kcal]||0),
      protein:colMap.protein>=0?+(cols[colMap.protein]||0):0,
      carb:   colMap.carb>=0?+(cols[colMap.carb]||0):0,
      fiber:  colMap.fiber>=0?+(cols[colMap.fiber]||0):0,
      fat:    colMap.fat>=0?+(cols[colMap.fat]||0):0,
      category:colMap.category>=0?(cols[colMap.category]||'其他'):'其他',
    });
  }

  if(toAdd.length===0){showToast(`無新增資料（已跳過 ${skipped} 筆重複）`,'info');return;}

  showToast(`正在匯入 ${toAdd.length} 筆...`,'info',5000);
  for(const food of toAdd){
    try{
      const res=await API.addFood(food);
      food.id=res.id;
      STATE.foods.push(food);
      added++;
    }catch(err){skipped++;}
  }
  renderFoodTable();
  showToast(`匯入完成：新增 ${added} 筆${skipped>0?`，跳過 ${skipped} 筆`:''}`, 'success', 4000);
};

window.openFoodModal=function(food=null){
  STATE.editingFoodId=food?food.id:null;
  document.getElementById('modalTitle').textContent=food?'編輯食物':'新增食物';
  document.getElementById('f_name').value=food?food.name:'';
  document.getElementById('f_unit').value=food?food.unit:'100g';
  document.getElementById('f_category').value=food?food.category:'蔬菜';
  document.getElementById('f_kcal').value=food?food.kcal:'';
  document.getElementById('f_protein').value=food?food.protein:'';
  document.getElementById('f_carb').value=food?food.carb:'';
  document.getElementById('f_fiber').value=food?food.fiber:'';
  document.getElementById('f_fat').value=food?food.fat:'';
  document.getElementById('foodModal').classList.add('open');
  setTimeout(()=>document.getElementById('f_name').focus(),100);
};
window.closeFoodModal=function(){document.getElementById('foodModal').classList.remove('open');};
window.editFood=function(id){const f=STATE.foods.find(x=>x.id===id);if(f)openFoodModal(f);};

window.saveFood=async function(){
  const food={
    id:STATE.editingFoodId,
    name:document.getElementById('f_name').value.trim(),
    unit:document.getElementById('f_unit').value.trim()||'100g',
    category:document.getElementById('f_category').value,
    kcal:parseFloat(document.getElementById('f_kcal').value)||0,
    protein:parseFloat(document.getElementById('f_protein').value)||0,
    carb:parseFloat(document.getElementById('f_carb').value)||0,
    fiber:parseFloat(document.getElementById('f_fiber').value)||0,
    fat:parseFloat(document.getElementById('f_fat').value)||0,
  };
  if(!food.name){showToast('請填寫食物名稱','error');return;}
  try{
    if(food.id){
      await API.updateFood(food);
      const idx=STATE.foods.findIndex(f=>f.id===food.id);
      if(idx>=0)STATE.foods[idx]=food;
      showToast(`已更新「${food.name}」`,'success');
    }else{
      const res=await API.addFood(food);food.id=res.id;STATE.foods.push(food);
      showToast(`已新增「${food.name}」`,'success');
    }
    closeFoodModal();renderFoodTable();
  }catch(e){showToast('儲存失敗：'+e.message,'error');}
};

window.confirmDeleteFood=function(id,name){
  document.getElementById('confirmMsg').textContent=`確定要刪除「${name}」嗎？`;
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmOkBtn').onclick=async()=>{
    try{await API.deleteFood(id);STATE.foods=STATE.foods.filter(f=>f.id!==id);renderFoodTable();showToast(`已刪除「${name}」`,'success');}
    catch(e){showToast('刪除失敗：'+e.message,'error');}
    closeConfirm();
  };
};
window.closeConfirm=function(){document.getElementById('confirmModal').classList.remove('open');};

// ══════════════════════════════════════════════════════════
//  MEAL LOGGER
// ══════════════════════════════════════════════════════════
function getTodayLogs(){return(STATE.logs[STATE.currentDate]||[]).filter(l=>l.meal!=='__water__');}
function getMealLogs(meal){return getTodayLogs().filter(l=>l.meal===meal);}
function calcTotals(logs){return logs.reduce((t,l)=>({kcal:t.kcal+(+l.kcal),protein:t.protein+(+l.protein),carb:t.carb+(+l.carb),fat:t.fat+(+l.fat)}),{kcal:0,protein:0,carb:0,fat:0});}

function renderMeals(){
  updateWaterUI();
  const container=document.getElementById('mealSections');
  if(!container)return;
  container.innerHTML=CONFIG.MEALS.map(meal=>{
    const mLogs=getMealLogs(meal),mt=calcTotals(mLogs);
    const rows=mLogs.map(log=>`<div class="log-item">
      <div><div class="log-food-name">${log.foodName}</div><div class="log-food-qty">${log.qty}g/ml</div></div>
      <div class="log-macro">${(+log.protein).toFixed(1)}g</div>
      <div class="log-macro">${(+log.carb).toFixed(1)}g</div>
      <div class="log-macro">${(+log.fat).toFixed(1)}g</div>
      <div class="log-kcal">${Math.round(+log.kcal)}</div>
      <button class="del-btn" onclick="removeLog('${log.id}','${meal}')">✕</button>
    </div>`).join('');
    return `<div class="meal-section">
      <div class="meal-header">
        <span class="meal-name">${meal}</span>
        <span class="meal-stat">${Math.round(mt.kcal)} kcal ∙ 蛋白${mt.protein.toFixed(0)}g ∙ 碳水${mt.carb.toFixed(0)}g ∙ 脂肪${mt.fat.toFixed(0)}g</span>
      </div>
      <div class="log-cols">
        <span class="log-col-h">食物</span><span class="log-col-h">蛋白質</span>
        <span class="log-col-h">碳水</span><span class="log-col-h">脂肪</span>
        <span class="log-col-h">熱量</span><span></span>
      </div>
      ${rows||'<div style="padding:6px 14px;font-size:14px;color:var(--ink-faint)">尚未記錄</div>'}
      <div class="add-row">
        <div class="autocomplete-wrap" id="ac-wrap-${meal}">
          <input class="add-input" id="ac-input-${meal}" type="text" placeholder="輸入食物名稱搜尋..."
            oninput="onAcInput('${meal}')" onkeydown="onAcKey(event,'${meal}')">
          <div class="autocomplete-list" id="ac-list-${meal}"></div>
        </div>
        <input class="add-input" id="qty-${meal}" type="number" value="100" min="1" placeholder="克/ml">
        <span style="font-size:14px;color:var(--ink-faint);align-self:center">g/ml</span>
        <button class="btn-primary" onclick="addLog('${meal}')">＋ 新增</button>
      </div>
    </div>`;
  }).join('');
  renderTotals();renderMealProgress();
}

let acSelected={};

window.onAcInput=function(meal){
  const q=(document.getElementById('ac-input-'+meal)?.value||'').trim().toLowerCase();
  const list=document.getElementById('ac-list-'+meal);
  acSelected[meal]=null;
  if(!q||!list){list&&list.classList.remove('open');return;}
  const matches=STATE.foods.filter(f=>f.name.toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){list.classList.remove('open');return;}
  list.innerHTML=matches.map(f=>`<div class="ac-item" onclick="selectFood('${meal}','${f.id}')">
    <div class="ac-item-name">${f.name}</div>
    <div class="ac-item-info">${f.unit} ∙ ${f.kcal}kcal ∙ 蛋白${f.protein}g ∙ 碳水${f.carb}g</div>
  </div>`).join('');
  list.classList.add('open');
};

window.selectFood=function(meal,id){
  const food=STATE.foods.find(f=>f.id===id);if(!food)return;
  acSelected[meal]=food;
  const inp=document.getElementById('ac-input-'+meal);if(inp)inp.value=food.name;
  const list=document.getElementById('ac-list-'+meal);if(list)list.classList.remove('open');
};

window.onAcKey=function(e,meal){
  if(e.key==='Escape')document.getElementById('ac-list-'+meal)?.classList.remove('open');
  if(e.key==='Enter'){e.preventDefault();addLog(meal);}
};
document.addEventListener('click',()=>document.querySelectorAll('.autocomplete-list').forEach(l=>l.classList.remove('open')));

window.addLog=async function(meal){
  const food=acSelected[meal];
  if(!food){showToast('請先選擇食物','error');return;}
  const qty=parseFloat(document.getElementById('qty-'+meal)?.value)||100;
  const r=qty/100;
  const log={date:STATE.currentDate,meal,foodId:food.id,foodName:food.name,qty,
    kcal:+(food.kcal*r).toFixed(1),protein:+(food.protein*r).toFixed(1),
    carb:+(food.carb*r).toFixed(1),fat:+(food.fat*r).toFixed(1),water:0};
  const badge=document.getElementById('savingBadge');
  if(badge){badge.style.display='';badge.textContent='儲存中...';}
  try{
    const saved=await API.saveLog(log);
    if(!STATE.logs[STATE.currentDate])STATE.logs[STATE.currentDate]=[];
    STATE.logs[STATE.currentDate].push(saved);
    acSelected[meal]=null;
    const inp=document.getElementById('ac-input-'+meal);if(inp)inp.value='';
    renderMeals();showToast(`已新增「${food.name}」`,'success');
  }catch(e){showToast('新增失敗：'+e.message,'error');}
  finally{if(badge)badge.style.display='none';}
};

window.removeLog=async function(id,meal){
  await API.deleteLog(id,STATE.currentDate);
  if(STATE.logs[STATE.currentDate])STATE.logs[STATE.currentDate]=STATE.logs[STATE.currentDate].filter(l=>l.id!==id);
  renderMeals();showToast('已刪除','success');
};

function renderTotals(){
  const tot=calcTotals(getTodayLogs()),T=STATE.target;
  const el=document.getElementById('totalGrid');if(!el)return;
  el.innerHTML=[
    {label:'熱量',  val:Math.round(tot.kcal),  unit:'kcal',tgt:T.kcal},
    {label:'蛋白質',val:tot.protein.toFixed(1), unit:'g',   tgt:T.protein},
    {label:'碳水',  val:tot.carb.toFixed(1),    unit:'g',   tgt:T.carb},
    {label:'脂肪',  val:tot.fat.toFixed(1),     unit:'g',   tgt:T.fat},
  ].map(x=>{
    const diff=parseFloat(x.val)-x.tgt;
    const cls=Math.abs(diff)<x.tgt*0.05?'tv-ok':diff>0?'tv-over':'tv-under';
    const sign=diff>0?'+':'';
    return `<div class="total-item">
      <div class="total-num">${x.val}<span class="total-unit"> ${x.unit}</span></div>
      <div class="total-label">${x.label}</div>
      <div class="total-vs ${cls}">目標 ${x.tgt}${x.unit}（${sign}${diff.toFixed(diff>10?0:1)}）</div>
    </div>`;
  }).join('');
}

function renderMealProgress(){
  const tot=calcTotals(getTodayLogs()),T=STATE.target;
  const el=document.getElementById('mealProgress');if(!el)return;
  el.innerHTML=[
    {l:'熱量',  cur:tot.kcal,    tgt:T.kcal,    col:CONFIG.CHART.green},
    {l:'蛋白質',cur:tot.protein, tgt:T.protein, col:CONFIG.CHART.protein},
    {l:'碳水',  cur:tot.carb,    tgt:T.carb,    col:CONFIG.CHART.carb},
    {l:'脂肪',  cur:tot.fat,     tgt:T.fat,     col:CONFIG.CHART.fat},
  ].map(b=>{
    const pct=Math.min(100,(b.cur/b.tgt)*100),over=b.cur>b.tgt*1.05;
    return `<div class="prog-wrap">
      <div class="prog-header"><span class="prog-label">${b.l}</span><span>${b.cur.toFixed(0)} / ${b.tgt}</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${over?'#b03a2e':b.col}"></div></div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════
function renderStatsForm(){
  const B=STATE.body,G=STATE.goal;
  const cf=document.getElementById('currentForm'),gf=document.getElementById('goalForm');
  const dateEl=document.getElementById('bodyStatDate');
  if(dateEl&&!dateEl.value) dateEl.value=todayStr();
  if(!cf||!gf)return;
  cf.innerHTML=`
    <div class="field-group"><label class="field-label">身高 (cm)</label><input class="field-input" id="s_height" type="number" value="${B.height||''}" placeholder="例：162" oninput="calcStats()"></div>
    <div class="field-group"><label class="field-label">體重 (kg)</label><input class="field-input" id="s_weight" type="number" value="${B.weight||''}" step="0.1" placeholder="例：48.4" oninput="calcStats()"></div>
    <div class="field-group"><label class="field-label">年齡</label><input class="field-input" id="s_age" type="number" value="${B.age||''}" placeholder="例：54" oninput="calcStats()"></div>
    <div class="field-group"><label class="field-label">體脂率 (%)</label><input class="field-input" id="s_fat" type="number" value="${B.fatPct||''}" step="0.1" placeholder="例：25.2" oninput="calcStats()"></div>
    <div class="field-group"><label class="field-label">骨骼肌率 (%)</label><input class="field-input" id="s_muscle" type="number" value="${B.musclePct||''}" step="0.1" placeholder="例：26.9" oninput="calcStats()"></div>
    <div class="field-group"><label class="field-label">活動量</label>
      <select class="field-input" id="s_activity" onchange="calcStats()">
        <option value="1.2"   ${B.activity==1.2  ?'selected':''}>久坐不動</option>
        <option value="1.375" ${B.activity==1.375?'selected':''}>輕度活動（每週1-3次）</option>
        <option value="1.45"  ${B.activity==1.45 ?'selected':''}>中度活動（每週3-5次）</option>
        <option value="1.55"  ${B.activity==1.55 ?'selected':''}>高度活動（每週6-7次）</option>
      </select></div>`;
  gf.innerHTML=`
    <div class="field-group"><label class="field-label">目標體重 (kg)</label><input class="field-input" id="g_weight" type="number" value="${G.weight}" step="0.1" oninput="calcStats()"></div>
    <div class="field-group"><label class="field-label">目標體脂率 (%)</label><input class="field-input" id="g_fat" type="number" value="${G.fatPct}" step="0.1" oninput="calcStats()"></div>
    <div class="field-group" style="grid-column:span 2"><label class="field-label">目標骨骼肌率 (%)</label><input class="field-input" id="g_muscle" type="number" value="${G.musclePct}" step="0.1" oninput="calcStats()"></div>`;
}

window.calcStats=function(){
  const h=+document.getElementById('s_height')?.value||STATE.body.height;
  const w=+document.getElementById('s_weight')?.value||STATE.body.weight;
  const a=+document.getElementById('s_age')?.value||STATE.body.age;
  const fp=+document.getElementById('s_fat')?.value||STATE.body.fatPct;
  const mp=+document.getElementById('s_muscle')?.value||STATE.body.musclePct;
  const act=+document.getElementById('s_activity')?.value||STATE.body.activity;
  STATE.body={height:h,weight:w,age:a,fatPct:fp,musclePct:mp,activity:act};
  const bmr=Math.round(10*w+6.25*h-5*a-161),tdee=Math.round(bmr*act);

  // 調整值：負數代表赤字（減重），正數代表盈餘（增重），0代表維持
  const adjInput=document.getElementById('kcalAdj');
  const adj=adjInput?+adjInput.value||0:0;
  const finalKcal=tdee+adj;

  const cr=document.getElementById('currentResults');
  if(cr)cr.innerHTML=[
    ['基礎代謝率 (BMR)',`${bmr} kcal`],
    ['每日總消耗 (TDEE)',`${tdee} kcal`],
    ['脂肪重量',`${(w*fp/100).toFixed(1)} kg`],
    ['骨骼肌重量',`${(w*mp/100).toFixed(1)} kg`],
    ['去脂體重',`${(w*(1-fp/100)).toFixed(1)} kg`],
    ['每日熱量赤字/盈餘',`<div class="kcal-adj-row"><span class="adj-hint">負數＝赤字減重，0＝維持，正數＝盈餘增肌</span><input id="kcalAdj" class="field-input adj-input" type="number" value="${adj}" placeholder="例：-26" oninput="calcStats()"> kcal</div>`],
    ['建議每日攝取',`<span class="res-hl">${finalKcal} kcal</span>`],
  ].map(([l,v])=>`<div class="result-row"><span class="res-label">${l}</span><span class="res-val">${v}</span></div>`).join('');

  // 三大營養素按比例自動連動（蛋白27% 碳水48% 脂肪25%）
  STATE.target.kcal    = finalKcal;
  STATE.target.protein = Math.round(finalKcal * 0.27 / 4);
  STATE.target.carb    = Math.round(finalKcal * 0.48 / 4);
  STATE.target.fat     = Math.round(finalKcal * 0.25 / 9);

  const gw=+document.getElementById('g_weight')?.value||STATE.goal.weight;
  const gfp=+document.getElementById('g_fat')?.value||STATE.goal.fatPct;
  const gmp=+document.getElementById('g_muscle')?.value||STATE.goal.musclePct;
  STATE.goal={weight:gw,fatPct:gfp,musclePct:gmp};
  const wD=(w-gw).toFixed(1),fD=(fp-gfp).toFixed(1),mD=(gmp-mp).toFixed(1);
  const def90=Math.round(+wD*7700/90),dailyT=Math.round(tdee-def90);
  const gr=document.getElementById('goalResults');
  if(gr)gr.innerHTML=[
    ['體重變化',`${wD>0?'-':''}${Math.abs(wD)} kg → ${gw} kg`],
    ['體脂率變化',`-${fD}% → ${gfp}%`],
    ['骨骼肌率增加',`+${mD}% → ${gmp}%`],
    ['達標所需每日赤字',`${def90} kcal`],
    ['90天每日建議攝取',`<span class="res-hl">${dailyT} kcal</span>`],
  ].map(([l,v])=>`<div class="result-row"><span class="res-label">${l}</span><span class="res-val">${v}</span></div>`).join('');
  renderCompChart(fp,gfp,mp,gmp);renderHistoryChart();
};

window.saveBodyStat=async function(){
  const dateEl=document.getElementById('bodyStatDate');
  const date=dateEl?dateEl.value:todayStr();
  if(!date){showToast('請選擇日期','error');return;}
  if(!STATE.body.weight){showToast('請輸入體重','error');return;}
  const stat={date,weight:STATE.body.weight,fatPct:STATE.body.fatPct,musclePct:STATE.body.musclePct,height:STATE.body.height,age:STATE.body.age};
  try{
    await API.saveBodyStat(stat);
    // 更新或新增到 bodyStats
    const idx=STATE.bodyStats.findIndex(s=>String(s.date).slice(0,10)===date);
    if(idx>=0) STATE.bodyStats[idx]=stat; else STATE.bodyStats.push(stat);
    showToast(`${date} 數據已儲存`,'success');
    renderHistoryChart();
    renderBodyStatTable();
    renderBodyStatYearOptions();
    renderDashboard();
  }
  catch(e){showToast('儲存失敗：'+e.message,'error');}
};

window.saveGoalSettings=async function(){
  const adjInput=document.getElementById('kcalAdj');
  const adj=adjInput?+adjInput.value||0:0;
  const s={
    goalWeight:STATE.goal.weight,
    goalFatPct:STATE.goal.fatPct,
    goalMusclePct:STATE.goal.musclePct,
    bodyHeight:STATE.body.height,
    bodyWeight:STATE.body.weight,
    bodyAge:STATE.body.age,
    bodyFatPct:STATE.body.fatPct,
    bodyMusclePct:STATE.body.musclePct,
    bodyActivity:STATE.body.activity,
    kcalAdj:adj,
    targetKcal:STATE.target.kcal,
    targetProtein:STATE.target.protein,
    targetCarb:STATE.target.carb,
    targetFat:STATE.target.fat
  };
  await API.saveSettings(s);
  showToast('目標設定已儲存','success');
};

let _bodyTableOpen = true;

window.toggleBodyStatTable = function(){
  _bodyTableOpen = !_bodyTableOpen;
  const el = document.getElementById('bodyStatTable');
  const icon = document.getElementById('bodyStatToggleIcon');
  if(el) el.style.display = _bodyTableOpen ? '' : 'none';
  if(icon) icon.textContent = _bodyTableOpen ? '▼' : '▶';
};

function renderBodyStatYearOptions(){
  const sel = document.getElementById('filterYear');
  if(!sel) return;
  const years = [...new Set(STATE.bodyStats.map(s => String(s.date).slice(0,4)))].sort((a,b)=>b-a);
  const cur = sel.value;
  sel.innerHTML = '<option value="">全部年度</option>' + years.map(y=>`<option value="${y}" ${y===cur?'selected':''}>${y}年</option>`).join('');
}

function renderBodyStatTable(){
  const el=document.getElementById('bodyStatTable');
  if(!el)return;
  if(!_bodyTableOpen){el.style.display='none';return;}

  const yr = document.getElementById('filterYear')?.value||'';
  const mo = document.getElementById('filterMonth')?.value||'';

  let stats=[...STATE.bodyStats].sort((a,b)=>(String(b.date).slice(0,10))>(String(a.date).slice(0,10))?1:-1);
  if(yr) stats=stats.filter(s=>String(s.date).slice(0,4)===yr);
  if(mo) stats=stats.filter(s=>String(s.date).slice(5,7)===mo);

  if(!stats.length){
    el.innerHTML='<p style="color:var(--ink-faint);font-size:14px;padding:12px 0">此區間無數據</p>';
    return;
  }
  el.innerHTML=`<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th>日期</th><th>體重 (kg)</th><th>體脂率 (%)</th><th>骨骼肌率 (%)</th><th>BMI</th><th>操作</th>
    </tr></thead>
    <tbody>${stats.map(s=>{
      const h=+s.height||STATE.body.height||162;
      const bmi=h?(+s.weight/((h/100)**2)).toFixed(1):'-';
      const bmiCls=bmi==='-'?'':+bmi<18.5?'color:var(--blue)':+bmi<24?'color:var(--green)':+bmi<27?'color:var(--amber)':'color:var(--red)';
      const dateStr=String(s.date).slice(0,10);
      const sid=s.id||'';
      return `<tr>
        <td style="font-weight:500">${dateStr}</td>
        <td>${s.weight||'-'}</td>
        <td>${s.fatPct||'-'}</td>
        <td>${s.musclePct||'-'}</td>
        <td style="${bmiCls};font-weight:600">${bmi}</td>
        <td><div class="action-btns">
          <button class="btn-icon edit" onclick="openEditBodyStat('${sid}')" title="編輯">✏️</button>
          <button class="btn-icon del"  onclick="confirmDeleteBodyStat('${sid}','${dateStr}')" title="刪除">🗑️</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}


// ── 身體數據 編輯/刪除 ────────────────────────────────────
window.openEditBodyStat = function(id) {
  const s = STATE.bodyStats.find(x => x.id === id);
  if (!s) return;
  document.getElementById('editBsId').value = s.id;
  document.getElementById('editBsDate').value = String(s.date).slice(0,10);
  document.getElementById('editBsWeight').value = s.weight||'';
  document.getElementById('editBsFat').value = s.fatPct||'';
  document.getElementById('editBsMuscle').value = s.musclePct||'';
  document.getElementById('editBsHeight').value = s.height||STATE.body.height||'';
  document.getElementById('editBsAge').value = s.age||STATE.body.age||'';
  document.getElementById('editBodyStatModal').classList.add('open');
};

window.closeEditBodyStat = function() {
  document.getElementById('editBodyStatModal').classList.remove('open');
};

window.saveEditBodyStat = async function() {
  const id = document.getElementById('editBsId').value;
  const stat = {
    id,
    date: document.getElementById('editBsDate').value,
    weight: +document.getElementById('editBsWeight').value,
    fatPct: +document.getElementById('editBsFat').value,
    musclePct: +document.getElementById('editBsMuscle').value,
    height: +document.getElementById('editBsHeight').value||STATE.body.height,
    age: +document.getElementById('editBsAge').value||STATE.body.age,
    note: ''
  };
  if (!stat.date || !stat.weight) { showToast('請填寫日期和體重', 'error'); return; }
  try {
    await API.saveBodyStatUpdate(stat);
    const idx = STATE.bodyStats.findIndex(x => x.id === id);
    if (idx >= 0) STATE.bodyStats[idx] = stat;
    closeEditBodyStat();
    showToast('數據已更新', 'success');
    renderHistoryChart();
    renderBodyStatTable();
    renderDashboard();
  } catch(e) { showToast('更新失敗：' + e.message, 'error'); }
};

window.confirmDeleteBodyStat = function(id, dateStr) {
  document.getElementById('confirmMsg').textContent = `確定要刪除 ${dateStr} 的身體數據嗎？`;
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmOkBtn').onclick = async () => {
    try {
      await API.deleteBodyStat(id);
      STATE.bodyStats = STATE.bodyStats.filter(x => x.id !== id);
      showToast('已刪除', 'success');
      renderHistoryChart();
      renderBodyStatTable();
      renderBodyStatYearOptions();
      renderDashboard();
    } catch(e) { showToast('刪除失敗：' + e.message, 'error'); }
    closeConfirm();
  };
};

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
function renderDashboard(){
  const tot=calcTotals(getTodayLogs()),B=STATE.body,T=STATE.target;
  const bmr=Math.round(10*B.weight+6.25*B.height-5*B.age-161),tdee=Math.round(bmr*B.activity),rem=Math.max(0,T.kcal-tot.kcal);
  const mg=document.getElementById('dashMetrics');
  if(mg)mg.innerHTML=[
    {label:'今日攝取',val:Math.round(tot.kcal),       unit:'kcal',sub:`目標 ${T.kcal} kcal`,   cls:'green'},
    {label:'剩餘熱量',val:Math.round(rem),             unit:'kcal',sub:`赤字目標 -200 kcal`,     cls:'amber'},
    {label:'基礎代謝',val:bmr,                         unit:'kcal',sub:`TDEE ${tdee} kcal`,      cls:'blue'},
    {label:'今日蛋白',val:tot.protein.toFixed(1),      unit:'g',   sub:`目標 ${T.protein}g`,     cls:tot.protein>=T.protein?'green':'red'},
  ].map(x=>`<div class="metric-card ${x.cls}"><div class="m-label">${x.label}</div><div class="m-value">${x.val}<span class="m-unit"> ${x.unit}</span></div><div class="m-sub">${x.sub}</div></div>`).join('');
  renderKcalChart(tot.kcal,T.kcal);
  const cv=document.getElementById('kcalCenterVal'),ct=document.getElementById('kcalTarget');
  if(cv)cv.textContent=Math.round(tot.kcal);if(ct)ct.textContent=T.kcal;
  const badge=document.getElementById('kcalBadge');
  if(badge){const pct=tot.kcal/T.kcal;if(pct>1.05){badge.textContent='超標';badge.className='badge red';}else if(pct>=0.85){badge.textContent='正常';badge.className='badge';}else{badge.textContent='攝取不足';badge.className='badge amber';}}
  renderMacroDoughnut(tot);renderDashProgress(tot);updateWaterUI();renderBodyComp();renderWeightChart();
}

function renderDashProgress(tot){
  const T=STATE.target,el=document.getElementById('dashProgress');if(!el)return;
  el.innerHTML=[
    {l:'熱量',  cur:tot.kcal,    tgt:T.kcal,    col:CONFIG.CHART.green},
    {l:'蛋白質',cur:tot.protein, tgt:T.protein, col:CONFIG.CHART.protein},
    {l:'碳水',  cur:tot.carb,    tgt:T.carb,    col:CONFIG.CHART.carb},
    {l:'脂肪',  cur:tot.fat,     tgt:T.fat,     col:CONFIG.CHART.fat},
  ].map(b=>{const pct=Math.min(100,(b.cur/b.tgt)*100),over=b.cur>b.tgt*1.05;return`<div class="prog-wrap"><div class="prog-header"><span class="prog-label">${b.l}</span><span>${b.cur.toFixed(0)} / ${b.tgt}</span></div><div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${over?'#b03a2e':b.col}"></div></div></div>`;}).join('');
}

function renderBodyComp(){
  const B=STATE.body,oth=Math.max(0,100-B.fatPct-B.musclePct-4);
  const bv=document.getElementById('bodyCompViz');
  if(bv)bv.innerHTML=`<div class="bv-bar-wrap"><div class="bv-seg seg-fat" style="width:${B.fatPct}%"></div><div class="bv-seg seg-muscle" style="width:${B.musclePct}%"></div><div class="bv-seg seg-bone" style="width:4%"></div><div class="bv-seg seg-other" style="width:${oth}%"></div></div><div class="bv-legend"><div class="bv-leg"><div class="bv-dot" style="background:#e87070"></div>體脂 ${B.fatPct}%</div><div class="bv-leg"><div class="bv-dot" style="background:var(--green-l)"></div>骨骼肌 ${B.musclePct}%</div><div class="bv-leg"><div class="bv-dot" style="background:var(--gold)"></div>骨骼 ~4%</div><div class="bv-leg"><div class="bv-dot" style="background:var(--border)"></div>其他 ${oth.toFixed(1)}%</div></div>`;
  const tot=calcTotals(getTodayLogs()),bs=document.getElementById('bodyStatus');
  if(bs)bs.innerHTML=[
    {label:'體重',      val:`${B.weight} kg`,           dot:B.weight<=STATE.goal.weight?'sd-g':'sd-a',      target:`目標 ${STATE.goal.weight} kg`},
    {label:'體脂率',    val:`${B.fatPct}%`,             dot:B.fatPct>25?'sd-r':'sd-a',                      target:`目標 ${STATE.goal.fatPct}%`},
    {label:'骨骼肌率',  val:`${B.musclePct}%`,          dot:B.musclePct<28?'sd-a':'sd-g',                   target:`目標 ${STATE.goal.musclePct}%`},
    {label:'今日蛋白質',val:`${tot.protein.toFixed(0)}g`,dot:tot.protein>=STATE.target.protein?'sd-g':'sd-a',target:`目標 ${STATE.target.protein}g`},
  ].map(x=>`<div class="status-row"><div class="s-dot ${x.dot}"></div><div class="s-label">${x.label}</div><div class="s-val">${x.val}<span class="s-tgt">${x.target}</span></div></div>`).join('');
}

function destroyChart(key){if(CHARTS[key]){CHARTS[key].destroy();delete CHARTS[key];}}

function renderKcalChart(eaten,total){
  destroyChart('kcal');const el=document.getElementById('kcalChart');if(!el)return;
  CHARTS.kcal=new Chart(el,{type:'doughnut',data:{labels:['已攝取','剩餘'],datasets:[{data:[Math.round(eaten),Math.round(Math.max(0,total-eaten))],backgroundColor:['#2d9e6e','#e8f5ee'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false}}}});
}

function renderMacroDoughnut(tot){
  destroyChart('macro');
  const ml=document.getElementById('macroLegend'),el=document.getElementById('macroChart');
  if(ml)ml.innerHTML=[{l:'蛋白質',c:CONFIG.CHART.protein,v:tot.protein.toFixed(0)+'g'},{l:'碳水',c:CONFIG.CHART.carb,v:tot.carb.toFixed(0)+'g'},{l:'脂肪',c:CONFIG.CHART.fat,v:tot.fat.toFixed(0)+'g'}].map(x=>`<div class="ml-item"><div class="ml-sq" style="background:${x.c}"></div>${x.l} ${x.v}</div>`).join('');
  if(!el)return;
  CHARTS.macro=new Chart(el,{type:'doughnut',data:{labels:['蛋白質','碳水','脂肪'],datasets:[{data:[+(tot.protein*4).toFixed(0)||1,+(tot.carb*4).toFixed(0)||1,+(tot.fat*9).toFixed(0)||1],backgroundColor:[CONFIG.CHART.protein,CONFIG.CHART.carb,CONFIG.CHART.fat],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:false}}}});
}

function renderWeightChart(){
  destroyChart('weight');const el=document.getElementById('weightChart');if(!el)return;
  const stats=STATE.bodyStats.slice(-14);
  const labels=stats.length>1?stats.map(s=>s.date):['Day1','Day2','Day3','Day4','Day5','Day6','今天'];
  const data=stats.length>1?stats.map(s=>+s.weight):[48.4,48.3,48.5,48.2,48.3,48.1,48.4];
  CHARTS.weight=new Chart(el,{type:'line',data:{labels,datasets:[{label:'體重',data,borderColor:CONFIG.CHART.green,backgroundColor:CONFIG.CHART.greenPale,tension:0.45,fill:true,pointRadius:4,pointBackgroundColor:CONFIG.CHART.green,pointBorderColor:'#fff',pointBorderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>v+'kg'},grid:{color:'rgba(0,0,0,0.04)'}},x:{grid:{display:false}}}}});
}

function renderCompChart(cf,gf,cm,gm){
  destroyChart('comp');const el=document.getElementById('compChart');if(!el)return;
  CHARTS.comp=new Chart(el,{type:'bar',data:{labels:['體脂率','骨骼肌率','水分+其他'],datasets:[{label:'目前',data:[cf,cm,+(100-cf-cm).toFixed(1)],backgroundColor:['#e87070','#2d9e6e','#aab8aa']},{label:'目標',data:[gf,gm,+(100-gf-gm).toFixed(1)],backgroundColor:['#f5c0bb','#c3e8d4','#dde8dd']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'bottom',labels:{font:{size:13},usePointStyle:true}}},scales:{y:{max:100,ticks:{callback:v=>v+'%'},grid:{color:'rgba(0,0,0,0.05)'}},x:{grid:{display:false}}}}});
}

function renderHistoryChart(){
  destroyChart('history');const el=document.getElementById('historyChart');if(!el)return;
  const stats=[...STATE.bodyStats].sort((a,b)=>a.date>b.date?1:-1).slice(-30);
  if(!stats.length)return;
  const labels=stats.map(s=>String(s.date).slice(0,10).slice(5)); // MM-DD
  CHARTS.history=new Chart(el,{type:'line',data:{labels,datasets:[
    {label:'體重(kg)',data:stats.map(s=>+s.weight||null),borderColor:'#2d9e6e',backgroundColor:'rgba(45,158,110,.08)',yAxisID:'y',tension:.4,fill:true,pointRadius:4,pointBackgroundColor:'#2d9e6e'},
    {label:'體脂率(%)',data:stats.map(s=>+s.fatPct||null),borderColor:'#e87070',backgroundColor:'transparent',yAxisID:'y2',tension:.4,pointRadius:3},
    {label:'骨骼肌率(%)',data:stats.map(s=>+s.musclePct||null),borderColor:'#1d5c8a',backgroundColor:'transparent',yAxisID:'y2',tension:.4,pointRadius:3,borderDash:[4,3]},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'bottom',labels:{font:{size:13},usePointStyle:true}}},scales:{y:{position:'left',ticks:{callback:v=>v+'kg'},grid:{color:'rgba(0,0,0,0.04)'}},y2:{position:'right',ticks:{callback:v=>v+'%'},grid:{display:false}},x:{grid:{display:false}}}}});
}

// ── 內建食物 ─────────────────────────────────────────────
function getBuiltinFoods(){
  const raw=[
    {n:'糙米（熟）',u:'100g',k:111,p:2.6,c:23,fi:1.8,f:0.9,t:'全穀'},
    {n:'白米飯（熟）',u:'100g',k:183,p:3.7,c:40.7,fi:0.3,f:0.3,t:'全穀'},
    {n:'燕麥片',u:'100g',k:389,p:13,c:66,fi:10.6,f:7,t:'全穀'},
    {n:'即食燕麥片',u:'100g',k:375,p:12.4,c:63,fi:9.1,f:6.5,t:'全穀'},
    {n:'藜麥（熟）',u:'100g',k:120,p:4,c:21,fi:2.8,f:1.9,t:'全穀'},
    {n:'地瓜（熟）',u:'100g',k:86,p:1.6,c:20,fi:3,f:0.1,t:'全穀'},
    {n:'紫薯（熟）',u:'100g',k:84,p:1.5,c:19.7,fi:2.5,f:0.1,t:'全穀'},
    {n:'馬鈴薯（熟）',u:'100g',k:87,p:1.9,c:20,fi:1.8,f:0.1,t:'全穀'},
    {n:'玉米（熟）',u:'100g',k:97,p:3.3,c:17.8,fi:4.7,f:2.5,t:'全穀'},
    {n:'玉米筍',u:'100g',k:26,p:2.3,c:5.8,fi:2.6,f:0.3,t:'全穀'},
    {n:'芋頭（熟）',u:'100g',k:94,p:1.5,c:22,fi:2.2,f:0.2,t:'全穀'},
    {n:'小米（熟）',u:'100g',k:119,p:3.5,c:23.7,fi:1.3,f:1,t:'全穀'},
    {n:'薏仁（熟）',u:'100g',k:147,p:3.8,c:32.7,fi:0.7,f:0.7,t:'全穀'},
    {n:'全麥吐司',u:'1片30g',k:79,p:3.4,c:14.8,fi:1.9,f:1.1,t:'全穀'},
    {n:'全麥麵條（熟）',u:'100g',k:124,p:5.3,c:23.2,fi:3.9,f:1.1,t:'全穀'},
    {n:'蕎麥麵（熟）',u:'100g',k:99,p:3.4,c:21.4,fi:1,f:0.1,t:'全穀'},
    {n:'冬粉（熟）',u:'100g',k:84,p:0.2,c:21,fi:0.5,f:0,t:'全穀'},
    {n:'米粉（熟）',u:'100g',k:109,p:0.9,c:25.9,fi:0.6,f:0.1,t:'全穀'},
    {n:'生豆皮',u:'100g',k:166,p:25,c:3,fi:0.1,f:6,t:'蛋白質'},
    {n:'板豆腐',u:'100g',k:67,p:7,c:2,fi:0.3,f:3.5,t:'蛋白質'},
    {n:'嫩豆腐',u:'100g',k:55,p:5,c:2.5,fi:0.2,f:2.7,t:'蛋白質'},
    {n:'天貝',u:'100g',k:193,p:19,c:9,fi:4.6,f:11,t:'蛋白質'},
    {n:'毛豆（熟）',u:'100g',k:122,p:11,c:10,fi:4.2,f:5,t:'豆類'},
    {n:'黑豆（熟）',u:'100g',k:132,p:8.9,c:23,fi:7.5,f:0.5,t:'豆類'},
    {n:'黃豆（熟）',u:'100g',k:173,p:16.6,c:9.9,fi:6,f:9,t:'豆類'},
    {n:'紅豆（熟）',u:'100g',k:128,p:7.6,c:24.8,fi:6.4,f:0.1,t:'豆類'},
    {n:'綠豆（熟）',u:'100g',k:105,p:7.5,c:19.2,fi:7.6,f:0.4,t:'豆類'},
    {n:'鷹嘴豆（熟）',u:'100g',k:164,p:8.9,c:27,fi:7.6,f:2.6,t:'豆類'},
    {n:'扁豆（熟）',u:'100g',k:116,p:9,c:20,fi:7.9,f:0.4,t:'豆類'},
    {n:'紅腰豆（熟）',u:'100g',k:127,p:8.7,c:22.8,fi:6.4,f:0.5,t:'豆類'},
    {n:'納豆',u:'100g',k:212,p:17.7,c:14.4,fi:6.7,f:11,t:'豆類'},
    {n:'豆干',u:'100g',k:152,p:16.9,c:2.8,fi:0.6,f:8.1,t:'豆類'},
    {n:'豆花',u:'100g',k:43,p:4.1,c:2.2,fi:0.2,f:2,t:'豆類'},
    {n:'豆漿（無糖）',u:'100ml',k:38,p:3.5,c:2.5,fi:0.3,f:1.8,t:'豆類'},
    {n:'雞蛋（全蛋）',u:'1顆50g',k:72,p:6,c:0.3,fi:0,f:5,t:'蛋類'},
    {n:'雞蛋白',u:'100g',k:52,p:11,c:0.7,fi:0,f:0.2,t:'蛋類'},
    {n:'雞蛋黃',u:'100g',k:353,p:15.9,c:3.6,fi:0,f:31.1,t:'蛋類'},
    {n:'水煮蛋',u:'1顆50g',k:78,p:6.3,c:0.6,fi:0,f:5.3,t:'蛋類'},
    {n:'皮蛋',u:'100g',k:143,p:13.7,c:1.7,fi:0,f:9,t:'蛋類'},
    {n:'全脂牛奶',u:'100ml',k:61,p:3.2,c:4.8,fi:0,f:3.3,t:'乳製品'},
    {n:'低脂牛奶',u:'100ml',k:46,p:3.3,c:4.8,fi:0,f:1,t:'乳製品'},
    {n:'希臘優格（無糖）',u:'100g',k:59,p:8.5,c:4,fi:0,f:0.5,t:'乳製品'},
    {n:'原味優格',u:'100g',k:72,p:3.5,c:8.3,fi:0,f:3.3,t:'乳製品'},
    {n:'茅屋起司',u:'100g',k:98,p:11.1,c:3.4,fi:0,f:4.3,t:'乳製品'},
    {n:'帕瑪森起司',u:'15g',k:61,p:5.6,c:0.2,fi:0,f:4,t:'乳製品'},
    {n:'無糖杏仁奶',u:'100ml',k:17,p:0.6,c:0.6,fi:0.4,f:1.5,t:'乳製品'},
    {n:'無糖燕麥奶',u:'100ml',k:47,p:1,c:8,fi:0.8,f:1.5,t:'乳製品'},
    {n:'菠菜',u:'100g',k:23,p:2.9,c:3.6,fi:2.2,f:0.4,t:'蔬菜'},
    {n:'花椰菜',u:'100g',k:34,p:2.8,c:5,fi:2.6,f:0.4,t:'蔬菜'},
    {n:'青花菜',u:'100g',k:31,p:2.5,c:6,fi:2.4,f:0.4,t:'蔬菜'},
    {n:'高麗菜',u:'100g',k:25,p:1.3,c:5.8,fi:2.5,f:0.1,t:'蔬菜'},
    {n:'小白菜',u:'100g',k:13,p:1.5,c:2.2,fi:1,f:0.2,t:'蔬菜'},
    {n:'空心菜',u:'100g',k:20,p:2.6,c:3.1,fi:1.8,f:0.2,t:'蔬菜'},
    {n:'地瓜葉',u:'100g',k:30,p:2.8,c:6,fi:3.1,f:0.3,t:'蔬菜'},
    {n:'青江菜',u:'100g',k:13,p:1.1,c:2.2,fi:1.1,f:0.2,t:'蔬菜'},
    {n:'羽衣甘藍',u:'100g',k:35,p:2.9,c:4.4,fi:4.1,f:1.5,t:'蔬菜'},
    {n:'番茄',u:'100g',k:18,p:0.9,c:3.9,fi:1.2,f:0.2,t:'蔬菜'},
    {n:'小黃瓜',u:'100g',k:15,p:0.7,c:3.6,fi:0.5,f:0.1,t:'蔬菜'},
    {n:'甜椒（紅）',u:'100g',k:31,p:1,c:6,fi:2.1,f:0.3,t:'蔬菜'},
    {n:'甜椒（黃）',u:'100g',k:27,p:1,c:6.3,fi:0.9,f:0.2,t:'蔬菜'},
    {n:'茄子',u:'100g',k:25,p:1,c:5.9,fi:3,f:0.2,t:'蔬菜'},
    {n:'秋葵',u:'100g',k:33,p:2,c:7.5,fi:3.2,f:0.1,t:'蔬菜'},
    {n:'蘆筍',u:'100g',k:20,p:2.2,c:3.9,fi:2.1,f:0.1,t:'蔬菜'},
    {n:'紅蘿蔔',u:'100g',k:41,p:0.9,c:9.6,fi:2.8,f:0.2,t:'蔬菜'},
    {n:'洋蔥',u:'100g',k:40,p:1.1,c:9.3,fi:1.7,f:0.1,t:'蔬菜'},
    {n:'韭菜',u:'100g',k:30,p:2.4,c:5.1,fi:3.4,f:0.3,t:'蔬菜'},
    {n:'芹菜',u:'100g',k:16,p:0.7,c:3,fi:1.6,f:0.2,t:'蔬菜'},
    {n:'苦瓜',u:'100g',k:19,p:0.9,c:4.3,fi:2.6,f:0.2,t:'蔬菜'},
    {n:'絲瓜',u:'100g',k:18,p:0.9,c:4,fi:0.7,f:0.1,t:'蔬菜'},
    {n:'冬瓜',u:'100g',k:13,p:0.4,c:3.1,fi:0.6,f:0.1,t:'蔬菜'},
    {n:'南瓜',u:'100g',k:26,p:1,c:6.5,fi:0.5,f:0.1,t:'蔬菜'},
    {n:'豆芽菜',u:'100g',k:30,p:3.1,c:5.9,fi:1.8,f:0.2,t:'蔬菜'},
    {n:'大蒜',u:'10g',k:15,p:0.6,c:3.3,fi:0.2,f:0.1,t:'蔬菜'},
    {n:'薑',u:'10g',k:8,p:0.2,c:1.8,fi:0.2,f:0.1,t:'蔬菜'},
    {n:'香菇（新鮮）',u:'100g',k:22,p:3.3,c:3.4,fi:2.5,f:0.3,t:'菇類'},
    {n:'香菇（乾燥）',u:'10g',k:31,p:2.2,c:6.4,fi:3.7,f:0.1,t:'菇類'},
    {n:'鴻禧菇',u:'100g',k:26,p:2.6,c:4.6,fi:2.7,f:0.3,t:'菇類'},
    {n:'金針菇',u:'100g',k:37,p:2.7,c:7,fi:2.7,f:0.3,t:'菇類'},
    {n:'杏鮑菇',u:'100g',k:35,p:2.8,c:6.7,fi:2.6,f:0.3,t:'菇類'},
    {n:'秀珍菇',u:'100g',k:24,p:2.4,c:4.6,fi:2.3,f:0.2,t:'菇類'},
    {n:'木耳（新鮮）',u:'100g',k:21,p:0.7,c:5.1,fi:5.1,f:0.2,t:'菇類'},
    {n:'蘑菇',u:'100g',k:22,p:3.1,c:3.3,fi:1,f:0.3,t:'菇類'},
    {n:'海帶（熟）',u:'100g',k:35,p:1.7,c:8.3,fi:1.3,f:0.6,t:'海藻'},
    {n:'紫菜（乾）',u:'10g',k:20,p:2.9,c:2.4,fi:0.3,f:0.3,t:'海藻'},
    {n:'海苔片',u:'10g',k:19,p:3.5,c:1.2,fi:0.4,f:0.3,t:'海藻'},
    {n:'昆布（乾）',u:'10g',k:14,p:0.6,c:3.2,fi:1.3,f:0.1,t:'海藻'},
    {n:'裙帶菜（熟）',u:'100g',k:45,p:3,c:9.1,fi:0.5,f:0.6,t:'海藻'},
    {n:'蘋果',u:'100g',k:52,p:0.3,c:14,fi:2.4,f:0.2,t:'水果'},
    {n:'香蕉',u:'100g',k:89,p:1.1,c:23,fi:2.6,f:0.3,t:'水果'},
    {n:'奇異果',u:'100g',k:61,p:1.1,c:14.7,fi:3,f:0.5,t:'水果'},
    {n:'草莓',u:'100g',k:32,p:0.7,c:7.7,fi:2,f:0.3,t:'水果'},
    {n:'藍莓',u:'100g',k:57,p:0.7,c:14,fi:2.4,f:0.3,t:'水果'},
    {n:'橘子',u:'100g',k:47,p:0.9,c:11.8,fi:2,f:0.1,t:'水果'},
    {n:'柳橙',u:'100g',k:47,p:0.9,c:11.8,fi:2.4,f:0.1,t:'水果'},
    {n:'芭樂',u:'100g',k:68,p:2.6,c:14.3,fi:5.4,f:1,t:'水果'},
    {n:'木瓜',u:'100g',k:43,p:0.5,c:10.8,fi:1.7,f:0.3,t:'水果'},
    {n:'芒果',u:'100g',k:60,p:0.8,c:15,fi:1.6,f:0.4,t:'水果'},
    {n:'西瓜',u:'100g',k:30,p:0.6,c:7.6,fi:0.4,f:0.2,t:'水果'},
    {n:'葡萄',u:'100g',k:69,p:0.7,c:18,fi:0.9,f:0.2,t:'水果'},
    {n:'梨',u:'100g',k:58,p:0.4,c:15.5,fi:3.1,f:0.1,t:'水果'},
    {n:'桃子',u:'100g',k:39,p:0.9,c:9.5,fi:1.5,f:0.3,t:'水果'},
    {n:'柿子',u:'100g',k:70,p:0.6,c:18.6,fi:3.6,f:0.2,t:'水果'},
    {n:'鳳梨',u:'100g',k:50,p:0.5,c:13.1,fi:1.4,f:0.1,t:'水果'},
    {n:'哈密瓜',u:'100g',k:34,p:0.8,c:8.2,fi:0.9,f:0.2,t:'水果'},
    {n:'龍眼',u:'100g',k:60,p:1.3,c:15.1,fi:1.1,f:0.1,t:'水果'},
    {n:'荔枝',u:'100g',k:66,p:0.8,c:16.5,fi:1.3,f:0.4,t:'水果'},
    {n:'核桃',u:'15g',k:98,p:2.3,c:1,fi:1,f:9.8,t:'堅果'},
    {n:'杏仁',u:'20g',k:116,p:4.3,c:3.9,fi:2.2,f:10,t:'堅果'},
    {n:'腰果',u:'20g',k:113,p:3.8,c:6.1,fi:0.6,f:9,t:'堅果'},
    {n:'花生（無鹽）',u:'20g',k:113,p:5.2,c:3.1,fi:1.5,f:9.4,t:'堅果'},
    {n:'花生醬（無糖）',u:'15g',k:90,p:3.9,c:2.8,fi:0.9,f:7.6,t:'堅果'},
    {n:'南瓜籽',u:'10g',k:57,p:2.9,c:1.3,fi:0.6,f:4.7,t:'堅果'},
    {n:'葵瓜籽',u:'10g',k:58,p:2.1,c:2,fi:0.9,f:5,t:'堅果'},
    {n:'芝麻',u:'10g',k:58,p:1.8,c:2.3,fi:1,f:5,t:'堅果'},
    {n:'芝麻醬',u:'15g',k:89,p:2.6,c:3.2,fi:1.4,f:7.8,t:'堅果'},
    {n:'奇亞籽',u:'10g',k:49,p:1.7,c:4.2,fi:3.4,f:3.1,t:'堅果'},
    {n:'亞麻籽',u:'10g',k:55,p:1.8,c:3,fi:2.8,f:4.3,t:'堅果'},
    {n:'開心果',u:'20g',k:114,p:4.2,c:5.6,fi:2.1,f:9.1,t:'堅果'},
    {n:'腰果醬',u:'15g',k:87,p:2.5,c:4.4,fi:0.4,f:7,t:'堅果'},
    {n:'橄欖油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
    {n:'亞麻籽油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
    {n:'椰子油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
    {n:'芝麻油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
    {n:'葵花油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
    {n:'酪梨油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
    {n:'酪梨',u:'100g',k:160,p:2,c:8.5,fi:6.7,f:14.7,t:'油脂'},
    {n:'無糖豆漿',u:'100ml',k:38,p:3.5,c:2.5,fi:0.3,f:1.8,t:'飲品'},
    {n:'無糖杏仁奶',u:'100ml',k:17,p:0.6,c:0.6,fi:0.4,f:1.5,t:'飲品'},
    {n:'無糖燕麥奶',u:'100ml',k:47,p:1,c:8,fi:0.8,f:1.5,t:'飲品'},
    {n:'黑咖啡',u:'250ml',k:5,p:0.3,c:0.5,fi:0,f:0,t:'飲品'},
    {n:'無糖綠茶',u:'250ml',k:0,p:0,c:0.3,fi:0,f:0,t:'飲品'},
    {n:'無糖烏龍茶',u:'250ml',k:0,p:0,c:0.5,fi:0,f:0,t:'飲品'},
    {n:'無糖紅茶',u:'250ml',k:2,p:0,c:0.7,fi:0,f:0,t:'飲品'},
    {n:'醬油',u:'10ml',k:7,p:0.8,c:1,fi:0,f:0,t:'調味料'},
    {n:'味噌',u:'15g',k:30,p:2,c:3.5,fi:0.5,f:1,t:'調味料'},
    {n:'蘋果醋',u:'15ml',k:3,p:0,c:0.5,fi:0,f:0,t:'調味料'},
  ];
  return raw.map((f,i)=>({id:'b'+(i+1),name:f.n,unit:f.u,kcal:f.k,protein:f.p,carb:f.c,fiber:f.fi,fat:f.f,category:f.t}));
}

// ── 啟動 ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
  s.onload=init;
  s.onerror=()=>{showToast('Chart.js載入失敗','error');init();};
  document.head.appendChild(s);
});
