const SHEET_ID = '1Kz3e99LKMmt6OvUTHxMaIPlOAfHsKPRlE4lU1ZULrgM';

const SHEETS = {
  FOODS:   'Foods',
  LOGS:    'DietLogs',
  BODY:    'BodyStats',
  SETTINGS:'Settings',
};

function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  let foods = ss.getSheetByName(SHEETS.FOODS);
  if (!foods) {
    foods = ss.insertSheet(SHEETS.FOODS);
    foods.appendRow(['id','name','unit','kcal','protein','carb','fiber','fat','category','createdAt']);
    foods.setFrozenRows(1);
    DEFAULT_FOODS.forEach(f => foods.appendRow([
      Utilities.getUuid(), f.n, f.u, f.k, f.p, f.c, f.fi, f.f, f.t,
      new Date().toISOString()
    ]));
  }

  let logs = ss.getSheetByName(SHEETS.LOGS);
  if (!logs) {
    logs = ss.insertSheet(SHEETS.LOGS);
    logs.appendRow(['id','date','meal','foodId','foodName','qty','kcal','protein','carb','fat','water','createdAt']);
    logs.setFrozenRows(1);
  }

  let body = ss.getSheetByName(SHEETS.BODY);
  if (!body) {
    body = ss.insertSheet(SHEETS.BODY);
    body.appendRow(['id','date','weight','fatPct','musclePct','height','age','note','createdAt']);
    body.setFrozenRows(1);
  }

  let settings = ss.getSheetByName(SHEETS.SETTINGS);
  if (!settings) {
    settings = ss.insertSheet(SHEETS.SETTINGS);
    settings.appendRow(['key','value']);
    settings.appendRow(['headerColor','#1a6b4a']);
    settings.appendRow(['targetKcal','1380']);
    settings.appendRow(['targetProtein','97']);
    settings.appendRow(['targetCarb','151']);
    settings.appendRow(['targetFat','43']);
    settings.appendRow(['targetWater','2000']);
  }

  return { status: 'ok', message: '初始化完成' };
}

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    switch (action) {
      case 'getFoods':     result = getFoods(); break;
      case 'getLogs':      result = getLogs(e.parameter.date); break;
      case 'getLogRange':  result = getLogRange(e.parameter.start, e.parameter.end); break;
      case 'getBodyStats': result = getBodyStats(); break;
      case 'getSettings':  result = getSettings(); break;
      default:             result = { error: 'Unknown action: ' + action };
    }
  } catch(err) {
    result = { error: err.message };
  }
  return jsonResponse(result);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  let result;
  try {
    switch (action) {
      case 'addFood':      result = addFood(data.food); break;
      case 'updateFood':   result = updateFood(data.food); break;
      case 'deleteFood':   result = deleteFood(data.id); break;
      case 'saveLog':      result = saveLog(data.log); break;
      case 'deleteLog':    result = deleteLog(data.id); break;
      case 'saveBodyStat': result = saveBodyStat(data.stat); break;
      case 'saveSettings': result = saveSettings(data.settings); break;
      case 'setup':        result = setup(); break;
      default:             result = { error: 'Unknown action: ' + action };
    }
  } catch(err) {
    result = { error: err.message };
  }
  return jsonResponse(result);
}

function getFoods() {
  const sheet = getSheet(SHEETS.FOODS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1).map(r => rowToObj(headers, r));
}

function addFood(food) {
  const sheet = getSheet(SHEETS.FOODS);
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, food.name, food.unit,
    +food.kcal, +food.protein, +food.carb, +food.fiber, +food.fat,
    food.category, new Date().toISOString()
  ]);
  return { status: 'ok', id };
}

function updateFood(food) {
  const sheet = getSheet(SHEETS.FOODS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === food.id) {
      sheet.getRange(i+1, 1, 1, 10).setValues([[
        food.id, food.name, food.unit,
        +food.kcal, +food.protein, +food.carb, +food.fiber, +food.fat,
        food.category, rows[i][9]
      ]]);
      return { status: 'ok' };
    }
  }
  return { error: 'Food not found' };
}

function deleteFood(id) {
  const sheet = getSheet(SHEETS.FOODS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sheet.deleteRow(i+1); return { status: 'ok' }; }
  }
  return { error: 'Not found' };
}

function getLogs(date) {
  const sheet = getSheet(SHEETS.LOGS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1)
    .filter(r => r[1] === date)
    .map(r => rowToObj(headers, r));
}

function getLogRange(start, end) {
  const sheet = getSheet(SHEETS.LOGS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1)
    .filter(r => r[1] >= start && r[1] <= end)
    .map(r => rowToObj(headers, r));
}

function saveLog(log) {
  const sheet = getSheet(SHEETS.LOGS);
  const id = log.id || Utilities.getUuid();
  if (log.id) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === log.id) {
        sheet.getRange(i+1, 1, 1, 12).setValues([[
          id, log.date, log.meal, log.foodId||'', log.foodName,
          +log.qty, +log.kcal, +log.protein, +log.carb, +log.fat,
          +log.water||0, rows[i][11]
        ]]);
        return { status: 'ok', id };
      }
    }
  }
  sheet.appendRow([
    id, log.date, log.meal, log.foodId||'', log.foodName,
    +log.qty, +log.kcal, +log.protein, +log.carb, +log.fat,
    +log.water||0, new Date().toISOString()
  ]);
  return { status: 'ok', id };
}

function deleteLog(id) {
  const sheet = getSheet(SHEETS.LOGS);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sheet.deleteRow(i+1); return { status: 'ok' }; }
  }
  return { error: 'Not found' };
}

function getBodyStats() {
  const sheet = getSheet(SHEETS.BODY);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1).map(r => rowToObj(headers, r));
}

function saveBodyStat(stat) {
  const sheet = getSheet(SHEETS.BODY);
  const id = Utilities.getUuid();
  sheet.appendRow([
    id, stat.date, +stat.weight, +stat.fatPct, +stat.musclePct,
    +stat.height, +stat.age, stat.note||'', new Date().toISOString()
  ]);
  return { status: 'ok', id };
}

function getSettings() {
  const sheet = getSheet(SHEETS.SETTINGS);
  const rows = sheet.getDataRange().getValues();
  const obj = {};
  rows.slice(1).forEach(r => { obj[r[0]] = r[1]; });
  return obj;
}

function saveSettings(settings) {
  const sheet = getSheet(SHEETS.SETTINGS);
  const rows = sheet.getDataRange().getValues();
  Object.entries(settings).forEach(([key, val]) => {
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        sheet.getRange(i+1, 2).setValue(val);
        rows[i][1] = val;
        found = true; break;
      }
    }
    if (!found) sheet.appendRow([key, val]);
  });
  return { status: 'ok' };
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) { setup(); sheet = ss.getSheetByName(name); }
  return sheet;
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

const DEFAULT_FOODS = [
  {n:'生豆皮',u:'100g',k:166,p:25,c:3,fi:0.1,f:6,t:'蛋白質'},
  {n:'板豆腐',u:'100g',k:67,p:7,c:2,fi:0.3,f:3.5,t:'蛋白質'},
  {n:'嫩豆腐',u:'100g',k:55,p:5,c:2.5,fi:0.2,f:2.7,t:'蛋白質'},
  {n:'天貝',u:'100g',k:193,p:19,c:9,fi:4.6,f:11,t:'蛋白質'},
  {n:'毛豆（熟）',u:'100g',k:122,p:11,c:10,fi:4.2,f:5,t:'豆類'},
  {n:'黑豆（熟）',u:'100g',k:132,p:8.9,c:23,fi:7.5,f:0.5,t:'豆類'},
  {n:'鷹嘴豆（熟）',u:'100g',k:164,p:8.9,c:27,fi:7.6,f:2.6,t:'豆類'},
  {n:'扁豆（熟）',u:'100g',k:116,p:9,c:20,fi:7.9,f:0.4,t:'豆類'},
  {n:'紅腰豆（熟）',u:'100g',k:127,p:8.7,c:22.8,fi:6.4,f:0.5,t:'豆類'},
  {n:'白腰豆（熟）',u:'100g',k:139,p:9.7,c:25,fi:6.3,f:0.6,t:'豆類'},
  {n:'雞蛋',u:'1顆50g',k:72,p:6,c:0.3,fi:0,f:5,t:'蛋白質'},
  {n:'蛋白（水煮）',u:'100g',k:52,p:11,c:0.7,fi:0,f:0.2,t:'蛋白質'},
  {n:'無糖豆漿',u:'100ml',k:38,p:3.5,c:2.5,fi:0.3,f:1.8,t:'飲品'},
  {n:'無糖杏仁奶',u:'100ml',k:17,p:0.6,c:0.6,fi:0.4,f:1.5,t:'飲品'},
  {n:'無糖燕麥奶',u:'100ml',k:47,p:1,c:8,fi:0.8,f:1.5,t:'飲品'},
  {n:'希臘優格（無糖）',u:'100g',k:59,p:8.5,c:4,fi:0,f:0.5,t:'乳製品'},
  {n:'全脂牛奶',u:'100ml',k:61,p:3.2,c:4.8,fi:0,f:3.3,t:'乳製品'},
  {n:'茅屋起司',u:'100g',k:98,p:11.1,c:3.4,fi:0,f:4.3,t:'乳製品'},
  {n:'燕麥片',u:'100g',k:389,p:13,c:66,fi:10.6,f:7,t:'全穀'},
  {n:'糙米（熟）',u:'100g',k:111,p:2.6,c:23,fi:1.8,f:0.9,t:'全穀'},
  {n:'藜麥（熟）',u:'100g',k:120,p:4,c:21,fi:2.8,f:1.9,t:'全穀'},
  {n:'全麥麵包',u:'1片35g',k:82,p:3.6,c:15,fi:2.1,f:1.1,t:'全穀'},
  {n:'地瓜（熟）',u:'100g',k:86,p:1.6,c:20,fi:3,f:0.1,t:'全穀'},
  {n:'紫薯（熟）',u:'100g',k:84,p:1.5,c:19.7,fi:2.5,f:0.1,t:'全穀'},
  {n:'玉米（熟）',u:'100g',k:96,p:3.4,c:19,fi:2.7,f:1.5,t:'全穀'},
  {n:'花椰菜',u:'100g',k:34,p:2.8,c:5,fi:2.6,f:0.4,t:'蔬菜'},
  {n:'青花菜',u:'100g',k:31,p:2.5,c:6,fi:2.4,f:0.4,t:'蔬菜'},
  {n:'菠菜',u:'100g',k:23,p:2.9,c:3.6,fi:2.2,f:0.4,t:'蔬菜'},
  {n:'羽衣甘藍',u:'100g',k:35,p:2.9,c:4.4,fi:4.1,f:1.5,t:'蔬菜'},
  {n:'高麗菜',u:'100g',k:25,p:1.3,c:5.8,fi:2.5,f:0.1,t:'蔬菜'},
  {n:'小白菜',u:'100g',k:13,p:1.5,c:2.2,fi:1,f:0.2,t:'蔬菜'},
  {n:'空心菜',u:'100g',k:20,p:2.6,c:3.1,fi:1.8,f:0.2,t:'蔬菜'},
  {n:'番茄',u:'100g',k:18,p:0.9,c:3.9,fi:1.2,f:0.2,t:'蔬菜'},
  {n:'小黃瓜',u:'100g',k:15,p:0.7,c:3.6,fi:0.5,f:0.1,t:'蔬菜'},
  {n:'甜椒（紅）',u:'100g',k:31,p:1,c:6,fi:2.1,f:0.3,t:'蔬菜'},
  {n:'茄子',u:'100g',k:25,p:1,c:5.9,fi:3,f:0.2,t:'蔬菜'},
  {n:'秋葵',u:'100g',k:33,p:2,c:7.5,fi:3.2,f:0.1,t:'蔬菜'},
  {n:'蘆筍',u:'100g',k:20,p:2.2,c:3.9,fi:2.1,f:0.1,t:'蔬菜'},
  {n:'紅蘿蔔',u:'100g',k:41,p:0.9,c:9.6,fi:2.8,f:0.2,t:'蔬菜'},
  {n:'洋蔥',u:'100g',k:40,p:1.1,c:9.3,fi:1.7,f:0.1,t:'蔬菜'},
  {n:'香菇（新鮮）',u:'100g',k:22,p:3.3,c:3.4,fi:2.5,f:0.3,t:'菇類'},
  {n:'鴻禧菇',u:'100g',k:26,p:2.6,c:4.6,fi:2.7,f:0.3,t:'菇類'},
  {n:'金針菇',u:'100g',k:37,p:2.7,c:7,fi:2.7,f:0.3,t:'菇類'},
  {n:'杏鮑菇',u:'100g',k:35,p:2.8,c:6.7,fi:2.6,f:0.3,t:'菇類'},
  {n:'木耳（新鮮）',u:'100g',k:21,p:0.7,c:5.1,fi:5.1,f:0.2,t:'菇類'},
  {n:'海帶（熟）',u:'100g',k:35,p:1.7,c:8.3,fi:1.3,f:0.6,t:'海藻'},
  {n:'紫菜（乾）',u:'10g',k:20,p:2.9,c:2.4,fi:0.3,f:0.3,t:'海藻'},
  {n:'蘋果',u:'100g',k:52,p:0.3,c:14,fi:2.4,f:0.2,t:'水果'},
  {n:'香蕉',u:'100g',k:89,p:1.1,c:23,fi:2.6,f:0.3,t:'水果'},
  {n:'奇異果',u:'100g',k:61,p:1.1,c:14.7,fi:3,f:0.5,t:'水果'},
  {n:'草莓',u:'100g',k:32,p:0.7,c:7.7,fi:2,f:0.3,t:'水果'},
  {n:'藍莓',u:'100g',k:57,p:0.7,c:14,fi:2.4,f:0.3,t:'水果'},
  {n:'橘子',u:'100g',k:47,p:0.9,c:11.8,fi:2,f:0.1,t:'水果'},
  {n:'芭樂',u:'100g',k:68,p:2.6,c:14.3,fi:5.4,f:1,t:'水果'},
  {n:'木瓜',u:'100g',k:43,p:0.5,c:10.8,fi:1.7,f:0.3,t:'水果'},
  {n:'核桃',u:'15g',k:98,p:2.3,c:1,fi:1,f:9.8,t:'堅果'},
  {n:'杏仁',u:'20g',k:116,p:4.3,c:3.9,fi:2.2,f:10,t:'堅果'},
  {n:'腰果',u:'20g',k:113,p:3.8,c:6.1,fi:0.6,f:9,t:'堅果'},
  {n:'南瓜籽',u:'10g',k:57,p:2.9,c:1.3,fi:0.6,f:4.7,t:'堅果'},
  {n:'奇亞籽',u:'10g',k:49,p:1.7,c:4.2,fi:3.4,f:3.1,t:'堅果'},
  {n:'亞麻籽',u:'10g',k:55,p:1.8,c:3,fi:2.8,f:4.3,t:'堅果'},
  {n:'芝麻',u:'10g',k:58,p:1.8,c:2.3,fi:1,f:5,t:'堅果'},
  {n:'花生醬（無糖）',u:'15g',k:90,p:3.9,c:2.8,fi:0.9,f:7.6,t:'堅果'},
  {n:'橄欖油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
  {n:'亞麻籽油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
  {n:'芝麻油',u:'10g',k:90,p:0,c:0,fi:0,f:10,t:'油脂'},
  {n:'酪梨',u:'100g',k:160,p:2,c:8.5,fi:6.7,f:14.7,t:'油脂'},
  {n:'黑咖啡',u:'250ml',k:5,p:0.3,c:0.5,fi:0,f:0,t:'飲品'},
  {n:'無糖綠茶',u:'250ml',k:0,p:0,c:0.3,fi:0,f:0,t:'飲品'},
];
