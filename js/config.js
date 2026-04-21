const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyHMdOMbFY-6BzHZqN-UToSBCUd7Ex1OZKlQ1KHiJndX_hVNYKeXtXLmpYgBD4F4cHQ3Q/exec',
  USE_CLOUD: true,
  TARGET: { kcal:1380, protein:97, carb:151, fat:43, water:2000 },
  BODY: { height:162, weight:48.4, age:54, fatPct:25.2, musclePct:26.9, activity:1.45 },
  GOAL: { weight:46, fatPct:21, musclePct:29 },
  HEADER_COLORS: [
    '#1a6b4a','#2d7a54','#3a9c6e','#1a4a2e',
    '#1d4e8a','#1a5c9e','#2980b9','#154360',
    '#2c3e50','#1a252f','#2e4053','#4a235a',
    '#6c3483','#7d3c98','#5b2c6f','#4a235a',
    '#922b21','#b03a2e','#a04000','#935116',
    '#7b6f00','#6e7b00','#557a1a','#2e7d32',
  ],
  MEALS: ['早餐','午餐','晚餐','點心'],
  CATEGORIES: ['蛋白質','豆類','全穀','蔬菜','水果','菇類','海藻','堅果','乳製品','油脂','飲品','其他'],
  CHART: { protein:'#1d5c8a', carb:'#b5882a', fat:'#b03a2e', green:'#2d9e6e', greenPale:'rgba(45,158,110,0.12)' },
};
