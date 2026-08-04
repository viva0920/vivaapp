/* =========================================================
   小熊工作台 — 记账 / 减肥 / 烘焙
   纯前端 + localStorage + 自绘 SVG 图表（无外部依赖）
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 工具 ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const monthStr = (d = new Date()) => d.toISOString().slice(0, 7);
  const fmt = (n) => "¥" + (Math.round(n * 100) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const store = {
    get(key, def) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
      catch (e) { return def; }
    },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
  };

  /* ---------- 默认类别 ---------- */
  const DEFAULT_CATS = {
    expense: [
      { name: "餐饮", icon: "🍔", color: "#FF9AA2" },
      { name: "交通", icon: "🚌", color: "#FFB7B2" },
      { name: "购物", icon: "🛍️", color: "#FFDAC1" },
      { name: "娱乐", icon: "🎮", color: "#B5EAD7" },
      { name: "居住", icon: "🏠", color: "#C7CEEA" },
      { name: "医疗", icon: "💊", color: "#E2A0F0" },
      { name: "学习", icon: "📚", color: "#A0E7E5" },
      { name: "牛奶", icon: "🥛", color: "#FFD3B6" },
      { name: "尿不湿", icon: "🧷", color: "#C9B6E4" },
      { name: "日用", icon: "🧴", color: "#A8E6CF" },
      { name: "玩具", icon: "🧸", color: "#FFF3B0" },
      { name: "其他", icon: "📦", color: "#F8B5C4" },
    ],
    income: [
      { name: "工资", icon: "💰", color: "#54C7B3" },
      { name: "兼职", icon: "💼", color: "#B4F8C8" },
      { name: "投资", icon: "📈", color: "#FBE7C6" },
      { name: "红包", icon: "🧧", color: "#FFAEBC" },
      { name: "其他", icon: "💸", color: "#D9C2F0" },
    ],
  };
  const PALETTE = ["#FF9AA2", "#FFB7B2", "#FFDAC1", "#B5EAD7", "#C7CEEA", "#E2A0F0", "#A0E7E5", "#F8B5C4", "#FFD3B6", "#C9B6E4", "#FFF3B0", "#A8E6CF"];

  // 把缺失的默认类别补进已保存的类别（不删除用户自定义项）
  function mergeCats(saved) {
    if (!saved || !saved.expense || !saved.income) return JSON.parse(JSON.stringify(DEFAULT_CATS));
    const out = { expense: [...saved.expense], income: [...saved.income] };
    ["expense", "income"].forEach((t) => {
      DEFAULT_CATS[t].forEach((d) => {
        if (!out[t].some((c) => c.name === d.name)) out[t].push(d);
      });
    });
    return out;
  }

  /* ---------- 全局状态 ---------- */
  const state = {
    records: store.get("wb_records", []),
    cats: mergeCats(store.get("wb_cats", null)),
    weights: store.get("wb_weights", []),
    goal: store.get("wb_goal", null),
    profile: store.get("wb_profile", null),
    recipes: store.get("wb_recipes", []),
    checkins: store.get("wb_checkins", {}),
    bakeSeeds: store.get("wb_bake_seeds", {}),
    favs: store.get("wb_favs", {}),
    favCols: store.get("wb_fav_cols", ["想做", "做过", "常做"]),
    bakeNotes: store.get("wb_bake_notes", {}),
    hot: store.get("wb_hot", null),
    shopping: store.get("wb_shopping", []),
    bp: store.get("wb_bp", null),
    exLibrary: store.get("wb_exlib", []),
    daily: store.get("wb_daily", null),
    currentMonth: monthStr(),
    chartType: "expense",
    recType: "expense",
    catColor: PALETTE[0],
    editingRecipeId: null,
  };

  const saveAll = () => {
    store.set("wb_records", state.records);
    store.set("wb_cats", state.cats);
    store.set("wb_weights", state.weights);
    store.set("wb_goal", state.goal);
    store.set("wb_recipes", state.recipes);
    store.set("wb_checkins", state.checkins);
    store.set("wb_bake_seeds", state.bakeSeeds);
    store.set("wb_favs", state.favs);
    store.set("wb_fav_cols", state.favCols);
    store.set("wb_bake_notes", state.bakeNotes);
    store.set("wb_shopping", state.shopping);
    store.set("wb_hot", state.hot);
    store.set("wb_bp", state.bp);
    store.set("wb_exlib", state.exLibrary);
    store.set("wb_daily", state.daily);
  };

  /* =========================================================
     模块切换
     ========================================================= */
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.module;
      $$(".nav-item").forEach((b) => b.classList.toggle("active", b === btn));
      $$(".module").forEach((sec) => sec.classList.toggle("active", sec.id === "module-" + m));
      try { store.set("wb_last_module", m); } catch (e) {}
      if (m === "daily") { try { showDailyScreen("cover"); } catch (e) {} }
    });
  });

  // 页面加载时自动显示上次查看的模块（首次进入显示第一个），避免内容区空白
  (function initActiveModule() {
    let m = null;
    try { m = store.get("wb_last_module", null); } catch (e) {}
    if (!m) {
      const first = document.querySelector(".nav-item");
      m = first ? first.dataset.module : null;
    }
    if (m) {
      $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.module === m));
      $$(".module").forEach((sec) => sec.classList.toggle("active", sec.id === "module-" + m));
      if (m === "daily") { try { showDailyScreen("cover"); } catch (e) {} }
    }
  })();

  /* =========================================================
     记账模块
     ========================================================= */
  const els = {
    monthLabel: $("#monthLabel"),
    totalIncome: $("#totalIncome"),
    totalExpense: $("#totalExpense"),
    balance: $("#balance"),
    pie: $("#pieChart"),
    legend: $("#pieLegend"),
    pieEmpty: $("#pieEmpty"),
    categorySelect: $("#categorySelect"),
    recordList: $("#recordList"),
    dateInput: $("#dateInput"),
  };

  function refreshCats() {
    const list = state.cats[state.recType];
    els.categorySelect.innerHTML = list
      .map((c, i) => `<option value="${i}">${c.icon} ${c.name}</option>`)
      .join("");
  }

  function renderMonth() {
    const [y, mo] = state.currentMonth.split("-");
    els.monthLabel.textContent = `${y}年${parseInt(mo, 10)}月`;
    const recs = state.records.filter((r) => r.date.startsWith(state.currentMonth));
    const income = recs.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
    const expense = recs.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
    els.totalIncome.textContent = fmt(income);
    els.totalExpense.textContent = fmt(expense);
    els.balance.textContent = fmt(income - expense);

    drawPie(recs);
    renderRecords(recs);
  }

  function groupByCat(recs) {
    const type = state.chartType;
    const list = state.cats[type];
    const map = {};
    list.forEach((c, i) => { map[c.name] = { ...c, value: 0, idx: i }; });
    recs.filter((r) => r.type === type).forEach((r) => {
      if (!map[r.category]) {
        // 类别被删但仍旧记录：补一个占位
        map[r.category] = { name: r.category, icon: "🏷️", color: "#ccc", value: 0 };
      }
      map[r.category].value += r.amount;
    });
    return Object.values(map).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  }

  function drawPie(recs) {
    const data = groupByCat(recs);
    const total = data.reduce((s, d) => s + d.value, 0);
    els.pie.innerHTML = "";
    els.legend.innerHTML = "";
    if (total <= 0) {
      els.pieEmpty.style.display = "block";
      return;
    }
    els.pieEmpty.style.display = "none";

    const cx = 100, cy = 100, rO = 90, rI = 56;
    let start = 0;
    const NS = "http://www.w3.org/2000/svg";
    data.forEach((d) => {
      const angle = (d.value / total) * 360;
      const end = start + angle;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", donutArc(cx, cy, rO, rI, start, end));
      path.setAttribute("fill", d.color);
      path.setAttribute("stroke", "#fff");
      path.setAttribute("stroke-width", "2");
      els.pie.appendChild(path);
      // 图例
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-dot" style="background:${d.color}"></span>
        <span class="legend-name">${d.icon} ${escapeHtml(d.name)}</span>
        <span class="legend-val">${fmt(d.value)}</span>`;
      els.legend.appendChild(item);
      start = end;
    });
    // 中心文字
    const t1 = document.createElementNS(NS, "text");
    t1.setAttribute("x", cx); t1.setAttribute("y", cy - 6);
    t1.setAttribute("text-anchor", "middle"); t1.setAttribute("fill", "#a08a98");
    t1.setAttribute("font-size", "13"); t1.textContent = state.chartType === "expense" ? "总支出" : "总收入";
    const t2 = document.createElementNS(NS, "text");
    t2.setAttribute("x", cx); t2.setAttribute("y", cy + 16);
    t2.setAttribute("text-anchor", "middle"); t2.setAttribute("fill", "#6b5563");
    t2.setAttribute("font-size", "18"); t2.setAttribute("font-weight", "800");
    t2.setAttribute("font-family", "Baloo 2, sans-serif");
    t2.textContent = fmt(total);
    els.pie.appendChild(t1); els.pie.appendChild(t2);
  }

  function donutArc(cx, cy, rO, rI, start, end) {
    const polar = (r, a) => {
      const rad = ((a - 90) * Math.PI) / 180;
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    };
    // 处理整圆
    if (end - start >= 359.999) end = start + 359.999;
    const [x1, y1] = polar(rO, end);
    const [x2, y2] = polar(rO, start);
    const [x3, y3] = polar(rI, start);
    const [x4, y4] = polar(rI, end);
    const large = end - start <= 180 ? 0 : 1;
    return `M${x1} ${y1} A${rO} ${rO} 0 ${large} 0 ${x2} ${y2} L${x3} ${y3} A${rI} ${rI} 0 ${large} 1 ${x4} ${y4} Z`;
  }

  function renderRecords(recs) {
    const sorted = [...recs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (!sorted.length) {
      els.recordList.innerHTML = `<li style="justify-content:center;color:#a08a98">这个月还没有记录哦 🐣</li>`;
      return;
    }
    els.recordList.innerHTML = sorted
      .map((r) => {
        const cat = state.cats[r.type].find((c) => c.name === r.category) || { icon: "🏷️", color: "#eee" };
        const sign = r.type === "income" ? "+" : "-";
        return `<li>
          <div class="rec-icon" style="background:${cat.color}33">${cat.icon}</div>
          <div class="rec-main">
            <div class="rec-cat">${escapeHtml(r.category)}</div>
            <div class="rec-note">${r.note ? escapeHtml(r.note) : r.date}</div>
          </div>
          <div class="rec-amount ${r.type}">${sign}${fmt(r.amount).slice(1)}</div>
          <button class="rec-del" data-id="${r.id}" title="删除">🗑️</button>
        </li>`;
      })
      .join("");
    $$(".rec-del", els.recordList).forEach((b) =>
      b.addEventListener("click", () => {
        state.records = state.records.filter((x) => x.id !== b.dataset.id);
        saveAll(); renderMonth();
      })
    );
  }

  /* 月份导航 */
  $("#prevMonth").addEventListener("click", () => {
    const [y, m] = state.currentMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    state.currentMonth = monthStr(d); renderMonth();
  });
  $("#nextMonth").addEventListener("click", () => {
    const [y, m] = state.currentMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    state.currentMonth = monthStr(d); renderMonth();
  });

  /* 图表类型切换 */
  $$(".ct-btn").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".ct-btn").forEach((x) => x.classList.toggle("active", x === b));
      state.chartType = b.dataset.chart;
      renderMonth();
    })
  );

  /* 收/支类型切换 */
  $$(".tt-btn").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".tt-btn").forEach((x) => x.classList.toggle("active", x === b));
      state.recType = b.dataset.type;
      refreshCats();
    })
  );

  /* 添加记录 */
  $("#recordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat($("#amountInput").value);
    const catIdx = parseInt(els.categorySelect.value, 10);
    const cat = state.cats[state.recType][catIdx];
    if (!(amount > 0) || !cat) return;
    state.records.push({
      id: uid(),
      type: state.recType,
      amount,
      category: cat.name,
      date: $("#dateInput").value || todayStr(),
      note: $("#noteInput").value.trim(),
    });
    saveAll();
    $("#amountInput").value = "";
    $("#noteInput").value = "";
    state.currentMonth = $("#dateInput").value.slice(0, 7) || state.currentMonth;
    renderMonth();
  });

  /* 添加类别弹窗 */
  const catModal = $("#catModal");
  function buildColorPicker() {
    $("#catColorPicker").innerHTML = PALETTE.map(
      (c) => `<span class="color-opt${c === state.catColor ? " sel" : ""}" data-c="${c}" style="background:${c}"></span>`
    ).join("");
    $$("#catColorPicker .color-opt").forEach((o) =>
      o.addEventListener("click", () => {
        state.catColor = o.dataset.c; buildColorPicker();
      })
    );
  }
  $("#addCategoryBtn").addEventListener("click", () => {
    $("#catTypeLabel").textContent = state.recType === "expense" ? "支出" : "收入";
    $("#catNameInput").value = "";
    $("#catIconInput").value = "🏷️";
    state.catColor = PALETTE[state.cats[state.recType].length % PALETTE.length];
    buildColorPicker();
    catModal.classList.add("show");
  });
  $("#catCancel").addEventListener("click", () => catModal.classList.remove("show"));
  $("#catSave").addEventListener("click", () => {
    const name = $("#catNameInput").value.trim();
    const icon = $("#catIconInput").value.trim() || "🏷️";
    if (!name) { alert("请输入类别名称"); return; }
    if (state.cats[state.recType].some((c) => c.name === name)) { alert("已有该类别啦"); return; }
    state.cats[state.recType].push({ name, icon, color: state.catColor });
    saveAll(); refreshCats(); catModal.classList.remove("show");
  });

  /* =========================================================
     减肥模块
     ========================================================= */
  const diet = {
    cur: $("#curWeight"), lost: $("#lostWeight"), goal: $("#goalWeight"),
    remain: $("#remainDays"), percent: $("#goalPercent"), bar: $("#goalBar"),
    list: $("#weightList"), chart: $("#weightChart"), empty: $("#weightEmpty"),
    planDate: $("#planDate"), kcalTarget: $("#kcalTarget"),
    mealList: $("#mealList"), exList: $("#exList"), planDone: $("#planDone"),
    foodDate: $("#foodDate"), foodGrid: $("#foodGrid"), foodPhoto: $("#foodPhoto"),
    weekPlan: $("#weekPlan"), weekToggle: $("#weekToggle"),
    planTotalKcal: $("#planTotalKcal"), planProtein: $("#planProtein"),
    exLibList: $("#exLibList"),
  };
  const planDate = () => diet.foodDate.value || todayStr();

  /* ----- 减脂餐 / 运动 内容池 ----- */
  const MEALS = {
    breakfast: [
      {
        name: "蔬菜鸡蛋饼", emoji: "🥞", slot: "breakfast", slotLabel: "早餐", kcal: 260, minutes: 12,
        tags: ["低脂", "高蛋白", "蔬菜多"], protein: 18, carbs: 22, fat: 10,
        ingredients: [{ name: "鸡蛋", amount: "2个" }, { name: "西葫芦", amount: "100g" }, { name: "胡萝卜", amount: "30g" }, { name: "全麦粉", amount: "10g" }],
        steps: [
          { emoji: "🥒", text: "西葫芦、胡萝卜擦细丝，加一点点盐腌3分钟，挤干水分" },
          { emoji: "🥚", text: "把鸡蛋打散，加入全麦粉和挤干的蔬菜丝拌匀" },
          { emoji: "🍳", text: "平底锅刷少许油，倒入蛋糊摊成薄饼，小火煎至两面金黄" }
        ],
        tips: "蔬菜丝挤掉水分饼更脆不散。",
        kw: "蔬菜鸡蛋饼 低卡 减脂"
      },
      {
        name: "燕麦蛋白杯", emoji: "🥣", slot: "breakfast", slotLabel: "早餐", kcal: 280, minutes: 5,
        tags: ["高纤", "高蛋白", "快手"], protein: 22, carbs: 35, fat: 6,
        ingredients: [{ name: "即食燕麦", amount: "40g" }, { name: "牛奶", amount: "200ml" }, { name: "蛋白粉", amount: "15g" }, { name: "香蕉", amount: "半根" }],
        steps: [
          { emoji: "🥣", text: "即食燕麦加牛奶微波炉加热1分钟" },
          { emoji: "🍌", text: "香蕉切片铺在燕麦上" },
          { emoji: "🥄", text: "加入蛋白粉搅拌均匀即可" }
        ],
        tips: "选无糖即食燕麦，蛋白粉可换希腊酸奶。",
        kw: "燕麦蛋白杯 减脂早餐"
      },
      {
        name: "全麦鸡蛋三明治", emoji: "🥪", slot: "breakfast", slotLabel: "早餐", kcal: 320, minutes: 10,
        tags: ["均衡", "饱腹感强"], protein: 20, carbs: 38, fat: 9,
        ingredients: [{ name: "全麦吐司", amount: "2片" }, { name: "鸡蛋", amount: "1个" }, { name: "生菜", amount: "2片" }, { name: "番茄", amount: "2片" }, { name: "低脂芝士", amount: "1片" }],
        steps: [
          { emoji: "🍳", text: "鸡蛋煎成荷包蛋或水煮切片" },
          { emoji: "🍞", text: "全麦吐司轻烤一下更香" },
          { emoji: "🥪", text: "依次放生菜、番茄、鸡蛋、芝士，盖上另一片吐司" }
        ],
        tips: "芝士选低脂款，控制钠摄入。",
        kw: "全麦鸡蛋三明治 低卡"
      },
      {
        name: "希腊酸奶莓果碗", emoji: "🍓", slot: "breakfast", slotLabel: "早餐", kcal: 240, minutes: 3,
        tags: ["低糖", "高蛋白", "抗氧化"], protein: 18, carbs: 28, fat: 5,
        ingredients: [{ name: "希腊酸奶", amount: "150g" }, { name: "蓝莓", amount: "30g" }, { name: "草莓", amount: "2颗" }, { name: "奇亚籽", amount: "5g" }],
        steps: [
          { emoji: "🥣", text: "希腊酸奶倒入碗中" },
          { emoji: "🫐", text: "蓝莓、草莓洗净切块摆上" },
          { emoji: "✨", text: "撒上奇亚籽，冷藏10分钟口感更佳" }
        ],
        tips: "希腊酸奶选无糖版，蛋白质更高。",
        kw: "希腊酸奶莓果碗 减脂"
      },
      {
        name: "紫薯奶昔", emoji: "🍠", slot: "breakfast", slotLabel: "早餐", kcal: 260, minutes: 5,
        tags: ["高纤", "低脂"], protein: 12, carbs: 45, fat: 4,
        ingredients: [{ name: "紫薯", amount: "100g" }, { name: "牛奶", amount: "200ml" }, { name: "蛋白粉", amount: "10g" }],
        steps: [
          { emoji: "🍠", text: "紫薯蒸熟去皮切块" },
          { emoji: "🥛", text: "和牛奶、蛋白粉一起放入搅拌机" },
          { emoji: "🥤", text: "搅打30秒至细腻" }
        ],
        tips: "紫薯本身有甜味，不需要额外加糖。",
        kw: "紫薯奶昔 减脂早餐"
      },
      {
        name: "牛油果吐司", emoji: "🥑", slot: "breakfast", slotLabel: "早餐", kcal: 330, minutes: 8,
        tags: ["优质脂肪", "高蛋白"], protein: 16, carbs: 32, fat: 15,
        ingredients: [{ name: "全麦吐司", amount: "1片" }, { name: "牛油果", amount: "半个" }, { name: "水煮蛋", amount: "1个" }, { name: "黑胡椒", amount: "少许" }],
        steps: [
          { emoji: "🍞", text: "全麦吐司烤至微脆" },
          { emoji: "🥑", text: "牛油果捣成泥，均匀涂抹在吐司上" },
          { emoji: "🥚", text: "放上切片水煮蛋，撒黑胡椒" }
        ],
        tips: "牛油果脂肪虽健康，但热量高，控制在半个。",
        kw: "牛油果吐司 减脂"
      },
    ],
    lunch: [
      {
        name: "鸡胸蔬菜沙拉", emoji: "🥗", slot: "lunch", slotLabel: "午餐", kcal: 360, minutes: 15,
        tags: ["低脂", "高蛋白"], protein: 38, carbs: 18, fat: 12,
        ingredients: [{ name: "鸡胸肉", amount: "120g" }, { name: "生菜", amount: "80g" }, { name: "黄瓜", amount: "50g" }, { name: "圣女果", amount: "5颗" }, { name: "玉米粒", amount: "30g" }],
        steps: [
          { emoji: "🍗", text: "鸡胸肉加少许盐和黑胡椒，煎至两面金黄切条" },
          { emoji: "🥬", text: "生菜洗净沥干，黄瓜切片，圣女果对半切" },
          { emoji: "🥗", text: "所有食材混合，淋低脂油醋汁拌匀" }
        ],
        tips: "油醋汁可用生抽+柠檬汁+少许橄榄油自制。",
        kw: "鸡胸蔬菜沙拉 减脂餐"
      },
      {
        name: "番茄豆腐荞麦面", emoji: "🍜", slot: "lunch", slotLabel: "午餐", kcal: 400, minutes: 18,
        tags: ["低GI", "高蛋白", "暖身"], protein: 28, carbs: 52, fat: 8,
        ingredients: [{ name: "荞麦面", amount: "60g（干重）" }, { name: "嫩豆腐", amount: "120g" }, { name: "番茄", amount: "1个" }, { name: "鸡蛋", amount: "1个" }, { name: "菠菜", amount: "50g" }],
        steps: [
          { emoji: "🍅", text: "番茄切块炒出汁，加一碗水煮开" },
          { emoji: "🍜", text: "放入荞麦面煮3分钟" },
          { emoji: "🥚", text: "加入嫩豆腐块和菠菜，淋入蛋液搅散即可" }
        ],
        tips: "荞麦面低GI，饱腹感强，适合减脂期。",
        kw: "番茄豆腐荞麦面 减脂"
      },
      {
        name: "虾仁西兰花", emoji: "🦐", slot: "lunch", slotLabel: "午餐", kcal: 340, minutes: 15,
        tags: ["低脂", "高蛋白"], protein: 34, carbs: 24, fat: 8,
        ingredients: [{ name: "鲜虾仁", amount: "120g" }, { name: "西兰花", amount: "150g" }, { name: "糙米饭", amount: "80g" }, { name: "蒜末", amount: "少许" }],
        steps: [
          { emoji: "🥦", text: "西兰花切小朵焯水2分钟捞出" },
          { emoji: "🦐", text: "虾仁用料酒、黑胡椒腌5分钟" },
          { emoji: "🍳", text: "少油爆香蒜末，炒虾仁至变色，加西兰花炒匀" }
        ],
        tips: "米饭用糙米或杂粮饭，控量80g熟重。",
        kw: "虾仁西兰花 减脂餐"
      },
      {
        name: "牛肉藜麦碗", emoji: "🥩", slot: "lunch", slotLabel: "午餐", kcal: 430, minutes: 25,
        tags: ["高蛋白", "高铁", "健身餐"], protein: 40, carbs: 38, fat: 14,
        ingredients: [{ name: "牛里脊", amount: "100g" }, { name: "藜麦", amount: "50g（干重）" }, { name: "彩椒", amount: "50g" }, { name: "洋葱", amount: "30g" }],
        steps: [
          { emoji: "🌾", text: "藜麦淘洗后煮15分钟至出小尾巴" },
          { emoji: "🥩", text: "牛里脊切条，用生抽、黑胡椒腌10分钟" },
          { emoji: "🍳", text: "少油快炒牛肉，加彩椒洋葱翻炒3分钟" }
        ],
        tips: "牛肉选里脊或牛腱，脂肪更低。",
        kw: "牛肉藜麦碗 减脂餐"
      },
      {
        name: "清蒸鱼+糙米饭", emoji: "🐟", slot: "lunch", slotLabel: "午餐", kcal: 420, minutes: 30,
        tags: ["低脂", "高蛋白", "清淡"], protein: 36, carbs: 48, fat: 8,
        ingredients: [{ name: "鲈鱼", amount: "120g" }, { name: "糙米饭", amount: "100g" }, { name: "姜丝", amount: "少许" }, { name: "葱丝", amount: "少许" }],
        steps: [
          { emoji: "🐟", text: "鱼身划几刀，铺姜丝，水开蒸8分钟" },
          { emoji: "🍚", text: "糙米饭提前煮好盛一碗" },
          { emoji: "✨", text: "鱼出锅倒掉汤汁，淋少许蒸鱼豉油和葱丝" }
        ],
        tips: "蒸鱼的汤汁含油脂，倒掉再淋豉油更清爽。",
        kw: "清蒸鱼 糙米 减脂餐"
      },
      {
        name: "鸡丝荞麦面", emoji: "🍜", slot: "lunch", slotLabel: "午餐", kcal: 390, minutes: 20,
        tags: ["高蛋白", "低GI"], protein: 34, carbs: 48, fat: 7,
        ingredients: [{ name: "鸡胸肉", amount: "100g" }, { name: "荞麦面", amount: "60g（干重）" }, { name: "黄瓜", amount: "50g" }, { name: "胡萝卜", amount: "30g" }],
        steps: [
          { emoji: "🍗", text: "鸡胸肉煮熟撕成细丝" },
          { emoji: "🍜", text: "荞麦面煮熟过凉水" },
          { emoji: "🥒", text: "黄瓜、胡萝卜切丝，和鸡丝、面条一起加低脂酱汁拌匀" }
        ],
        tips: "酱汁可用生抽+醋+少许香油+蒜末。",
        kw: "鸡丝荞麦面 减脂"
      },
    ],
    dinner: [
      {
        name: "番茄龙利鱼", emoji: "🍅", slot: "dinner", slotLabel: "晚餐", kcal: 300, minutes: 20,
        tags: ["低脂", "高蛋白"], protein: 30, carbs: 18, fat: 8,
        ingredients: [{ name: "龙利鱼", amount: "150g" }, { name: "番茄", amount: "2个" }, { name: "金针菇", amount: "50g" }, { name: "番茄酱", amount: "10g" }],
        steps: [
          { emoji: "🐟", text: "龙利鱼切块，用料酒、黑胡椒腌10分钟" },
          { emoji: "🍅", text: "番茄切块炒出汁，加一碗水烧开" },
          { emoji: "🍲", text: "放入鱼块和金针菇，煮5分钟至鱼熟透" }
        ],
        tips: "番茄酱选无添加糖款，只借番茄酸味。",
        kw: "番茄龙利鱼 减脂晚餐"
      },
      {
        name: "凉拌鸡丝黄瓜", emoji: "🥒", slot: "dinner", slotLabel: "晚餐", kcal: 280, minutes: 15,
        tags: ["低脂", "高蛋白"], protein: 32, carbs: 10, fat: 9,
        ingredients: [{ name: "鸡胸肉", amount: "120g" }, { name: "黄瓜", amount: "1根" }, { name: "蒜末", amount: "少许" }, { name: "小米辣", amount: "少许" }],
        steps: [
          { emoji: "🍗", text: "鸡胸肉煮熟撕成细丝" },
          { emoji: "🥒", text: "黄瓜拍碎切块" },
          { emoji: "🥢", text: "加蒜末、小米辣、生抽、醋、少许香油拌匀" }
        ],
        tips: "小米辣提味，不爱辣可换香菜。",
        kw: "凉拌鸡丝黄瓜 减脂"
      },
      {
        name: "蒸蛋羹+时蔬", emoji: "🥚", slot: "dinner", slotLabel: "晚餐", kcal: 260, minutes: 18,
        tags: ["嫩滑", "低脂"], protein: 22, carbs: 12, fat: 12,
        ingredients: [{ name: "鸡蛋", amount: "2个" }, { name: "温水", amount: "100ml" }, { name: "西兰花", amount: "80g" }, { name: "胡萝卜", amount: "30g" }],
        steps: [
          { emoji: "🥚", text: "鸡蛋打散加温水搅匀，过筛去气泡" },
          { emoji: "🥦", text: "西兰花、胡萝卜焯水" },
          { emoji: "🍳", text: "蛋液盖保鲜膜蒸10分钟，放蔬菜再蒸3分钟" }
        ],
        tips: "蛋液和温水比例 1:1.5，口感更嫩。",
        kw: "蒸蛋羹 减脂晚餐"
      },
      {
        name: "烤三文鱼芦笋", emoji: "🐟", slot: "dinner", slotLabel: "晚餐", kcal: 280, minutes: 22,
        tags: ["优质脂肪", "高蛋白"], protein: 32, carbs: 6, fat: 14,
        ingredients: [{ name: "三文鱼", amount: "100g" }, { name: "芦笋", amount: "100g" }, { name: "柠檬", amount: "2片" }, { name: "黑胡椒", amount: "少许" }],
        steps: [
          { emoji: "🐟", text: "三文鱼用黑胡椒、柠檬汁腌10分钟" },
          { emoji: "🥬", text: "芦笋切段，和鱼一起摆入烤盘" },
          { emoji: "🔥", text: "烤箱200度烤12-15分钟" }
        ],
        tips: "三文鱼提供优质Omega-3，减脂期友好。",
        kw: "烤三文鱼芦笋 减脂"
      },
      {
        name: "白灼虾+芦笋", emoji: "🍤", slot: "dinner", slotLabel: "晚餐", kcal: 290, minutes: 15,
        tags: ["低脂", "高蛋白"], protein: 36, carbs: 8, fat: 6,
        ingredients: [{ name: "鲜虾", amount: "150g" }, { name: "芦笋", amount: "100g" }, { name: "姜片", amount: "少许" }],
        steps: [
          { emoji: "🍤", text: "水加姜片烧开，放入虾煮至变红捞出" },
          { emoji: "🥬", text: "芦笋焯水2分钟" },
          { emoji: "🍽️", text: "蘸料用生抽+芥末或醋+蒜末" }
        ],
        tips: "虾壳保留煮更鲜，吃时剥皮。",
        kw: "白灼虾 芦笋 减脂"
      },
      {
        name: "烤蔬菜沙拉", emoji: "🥦", slot: "dinner", slotLabel: "晚餐", kcal: 270, minutes: 25,
        tags: ["纯素", "低脂"], protein: 12, carbs: 32, fat: 10,
        ingredients: [{ name: "西兰花", amount: "100g" }, { name: "南瓜", amount: "80g" }, { name: "口蘑", amount: "50g" }, { name: "鹰嘴豆", amount: "30g" }],
        steps: [
          { emoji: "🥦", text: "蔬菜洗净切块，喷少许油" },
          { emoji: "🧂", text: "撒盐、黑胡椒、蒜粉拌匀" },
          { emoji: "🔥", text: "烤箱200度烤18分钟" }
        ],
        tips: "鹰嘴豆提前煮熟或买即食罐装，增加蛋白质。",
        kw: "烤蔬菜沙拉 减脂"
      },
    ],
    snack: [
      {
        name: "原味杏仁一小把", emoji: "🥜", slot: "snack", slotLabel: "加餐", kcal: 120, minutes: 1,
        tags: ["健康脂肪", "饱腹"], protein: 4, carbs: 4, fat: 10,
        ingredients: [{ name: "原味巴旦木", amount: "15g（约10颗）" }],
        steps: [{ emoji: "🥜", text: "直接吃，细嚼慢咽增加饱腹感" }],
        tips: "坚果热量高，15g 足够，选原味无添加。",
        kw: "杏仁 健康零食 减脂"
      },
      {
        name: "水煮蛋一个", emoji: "🥚", slot: "snack", slotLabel: "加餐", kcal: 80, minutes: 5,
        tags: ["高蛋白", "便携"], protein: 7, carbs: 1, fat: 5,
        ingredients: [{ name: "鸡蛋", amount: "1个" }],
        steps: [
          { emoji: "💧", text: "鸡蛋冷水下锅" },
          { emoji: "⏰", text: "水开后煮8分钟" },
          { emoji: "🧊", text: "过凉水剥壳" }
        ],
        tips: "煮8分钟是全熟，蛋黄不噎。",
        kw: "水煮蛋 减脂加餐"
      },
      {
        name: "苹果+酸奶", emoji: "🍎", slot: "snack", slotLabel: "加餐", kcal: 150, minutes: 3,
        tags: ["低卡", "助消化"], protein: 6, carbs: 28, fat: 2,
        ingredients: [{ name: "苹果", amount: "1个（小）" }, { name: "无糖酸奶", amount: "100g" }],
        steps: [
          { emoji: "🍎", text: "苹果洗净切块" },
          { emoji: "🥣", text: "蘸酸奶吃" }
        ],
        tips: "苹果连皮吃膳食纤维更多。",
        kw: "苹果酸奶 减脂加餐"
      },
      {
        name: "黄瓜小番茄", emoji: "🍅", slot: "snack", slotLabel: "加餐", kcal: 60, minutes: 1,
        tags: ["超低卡", "解馋"], protein: 2, carbs: 12, fat: 0,
        ingredients: [{ name: "黄瓜", amount: "半根" }, { name: "小番茄", amount: "8颗" }],
        steps: [{ emoji: "🥒", text: "洗净切块，当零嘴吃" }],
        tips: "嘴馋时首选，热量几乎可忽略。",
        kw: "黄瓜 小番茄 减脂"
      },
      {
        name: "蛋白粉奶昔", emoji: "🥤", slot: "snack", slotLabel: "加餐", kcal: 130, minutes: 2,
        tags: ["高蛋白", "健身"], protein: 25, carbs: 6, fat: 2,
        ingredients: [{ name: "乳清蛋白粉", amount: "25g" }, { name: "水", amount: "250ml" }],
        steps: [
          { emoji: "🥄", text: "蛋白粉加入摇摇杯" },
          { emoji: "💧", text: "加水摇匀" }
        ],
        tips: "训练后30分钟内喝，补充蛋白质最佳。",
        kw: "蛋白粉奶昔 减脂"
      },
    ],
  };
  const EXERCISES = [
    { name: "帕梅拉快乐燃脂", emoji: "🔥", min: 20, cat: "HIIT", kw: "帕梅拉 快乐燃脂 20分钟" },
    { name: "本草纲目毽子操", emoji: "💃", min: 30, cat: "有氧", kw: "本草纲目 毽子操 完整版" },
    { name: "跳绳 HIIT", emoji: "🤾", min: 15, cat: "HIIT", kw: "跳绳 HIIT 燃脂" },
    { name: "瑜伽拉伸放松", emoji: "🧘", min: 20, cat: "拉伸", kw: "瑜伽 拉伸 放松" },
    { name: "腹部核心训练", emoji: "💪", min: 15, cat: "力量", kw: "腹部 核心 训练 马甲线" },
    { name: "跑步机快走", emoji: "🏃", min: 30, cat: "有氧", kw: "快走 有氧 减脂" },
    { name: "开合跳燃脂操", emoji: "⭐", min: 12, cat: "HIIT", kw: "开合跳 燃脂操" },
    { name: "臀腿力量训练", emoji: "🍑", min: 25, cat: "力量", kw: "臀腿 力量 训练" },
    { name: "游泳", emoji: "🏊", min: 40, cat: "有氧", kw: "游泳 减脂 正确姿势" },
    { name: "骑行", emoji: "🚴", min: 35, cat: "有氧", kw: "骑行 减脂 户外" },
    { name: "波比跳", emoji: "🤸", min: 10, cat: "HIIT", kw: "波比跳 燃脂 新手" },
    { name: "平板支撑", emoji: "🛡️", min: 5, cat: "力量", kw: "平板支撑 核心 训练" },
    { name: "深蹲训练", emoji: "🏋️", min: 15, cat: "力量", kw: "深蹲 腿部 训练" },
    { name: "普拉提", emoji: "🌿", min: 25, cat: "塑形", kw: "普拉提 核心 塑形" },
    { name: "八段锦", emoji: "🧎", min: 15, cat: "拉伸", kw: "八段锦 养生 拉伸" },
    { name: "舞蹈燃脂", emoji: "🪩", min: 30, cat: "有氧", kw: "舞蹈 燃脂 跟练" },
  ];
  const bili = (kw) => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(kw);

  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  // 按日期确定性挑选 count 项：
  // 用日期哈希做种子对池子做 Fisher-Yates 洗牌，再取前 count 项。
  // 同一天种子相同 → 结果一致；相邻日期种子不同 → 排列明显不同，保证每日更新。
  function pickDaily(pool, dateStr, count) {
    let s = (hashStr(dateStr) || 1) >>> 0;
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) >>> 0;
      const j = s % (i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr.slice(0, count);
  }

  function currentWeight() {
    const ws = [...state.weights].sort((a, b) => (a.date < b.date ? 1 : -1));
    return ws.length ? ws[0].weight : (state.profile && state.profile.weight) || null;
  }

  function computeKcalTarget() {
    const w = currentWeight();
    const p = state.profile;
    if (p && p.height && p.age && w) {
      const bmr = p.sex === "m"
        ? 10 * w + 6.25 * p.height - 5 * p.age + 5
        : 10 * w + 6.25 * p.height - 5 * p.age - 161;
      const tdee = bmr * (p.activity || 1.375);
      return Math.max(1200, Math.round(tdee - 500));
    }
    return 1300; // 未完善信息时的通用减脂摄入
  }

  const SLOT_LABELS = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
  const SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack"];

  function getDefaultMeals(dateStr) {
    const out = {};
    SLOT_ORDER.forEach((slot) => {
      const m = pickDaily(MEALS[slot], dateStr, 1)[0];
      out[slot] = { ...m, slot, slotLabel: SLOT_LABELS[slot] };
    });
    return out;
  }

  function renderPlan(dateStr) {
    diet.planDate.textContent = dateStr.slice(5);
    diet.kcalTarget.textContent = computeKcalTarget();
    const ci = state.checkins[dateStr] || (state.checkins[dateStr] = { done: {}, customEx: [] });
    if (!ci.customEx) ci.customEx = [];
    if (!ci.meals || !ci.meals.breakfast) ci.meals = getDefaultMeals(dateStr);
    const meals = ci.meals;

    let totalKcal = 0, totalP = 0, totalC = 0, totalF = 0;
    SLOT_ORDER.forEach((slot) => {
      const m = meals[slot];
      totalKcal += m.kcal || 0;
      totalP += m.protein || 0;
      totalC += m.carbs || 0;
      totalF += m.fat || 0;
    });
    if (diet.planTotalKcal) diet.planTotalKcal.textContent = totalKcal;
    if (diet.planProtein) diet.planProtein.textContent = totalP;

    diet.mealList.innerHTML = SLOT_ORDER.map((slot) => {
      const m = meals[slot];
      const key = "meal:" + slot + ":" + m.name;
      const done = !!ci.done[key];
      const detailId = "meal-detail-" + slot + "-" + dateStr;
      return `<div class="meal-card${done ? " done" : ""}" data-key="${key}">
        <div class="meal-header">
          <div class="meal-emoji">${m.emoji}</div>
          <div class="meal-main">
            <div class="meal-name">${m.slotLabel} · ${escapeHtml(m.name)}</div>
            <div class="meal-tags">${(m.tags || []).map((t) => '<span class="meal-tag">' + escapeHtml(t) + '</span>').join("")}<span class="meal-tag time">🕒 ${m.minutes}分钟</span></div>
          </div>
          <div class="meal-kcal"><b>${m.kcal}</b><small>kcal</small></div>
        </div>
        <div class="meal-macro">蛋白质 ${m.protein}g · 碳水 ${m.carbs}g · 脂肪 ${m.fat}g</div>
        <div class="meal-actions">
          <button class="meal-toggle${done ? " checked" : ""}" data-key="${key}">${done ? "✅ 已完成" : "□ 完成"}</button>
          <button class="meal-video" data-kw="${escapeHtml(m.kw)}">▶ 看视频</button>
          <button class="meal-detail-btn" data-slot="${slot}">👩‍🍳 做法</button>
          <button class="meal-shuffle" data-slot="${slot}">🔄 换一份</button>
        </div>
        <div class="meal-detail" id="${detailId}" style="display:none">
          <div class="meal-section">
            <h4>🥗 食材</h4>
            <div class="meal-ingredients">${(m.ingredients || []).map((ing) => '<span class="ing-tag">' + escapeHtml(ing.name) + " " + escapeHtml(ing.amount) + '</span>').join("")}</div>
          </div>
          <div class="meal-section">
            <h4>👩‍🍳 做法</h4>
            <div class="meal-steps">${(m.steps || []).map((s, i) => '<div class="step-row"><span class="step-emoji">' + s.emoji + '</span><span class="step-text"><b>步骤' + (i + 1) + '</b> ' + escapeHtml(s.text) + '</span></div>').join("")}</div>
          </div>
          ${m.tips ? '<div class="meal-tips">💡 <b>小贴士：</b>' + escapeHtml(m.tips) + '</div>' : ""}
        </div>
      </div>`;
    }).join("");

    const ex = pickDaily(EXERCISES, dateStr, 3);
    diet.exList.innerHTML = ex.map((e) => exCard(e, "ex:" + e.name, ci, false)).join("")
      + ci.customEx.map((c) => exCard(c, "exC:" + c.id, ci, true)).join("");

    const lib = state.exLibrary || [];
    diet.exLibList.innerHTML = lib.length
      ? lib.map((item) => libCard(item, (ci.customEx || []).some((x) => x.id === item.id))).join("")
      : '<div class="ex-lib-empty">还没有自定义运动，点上方「➕ 添加我的运动到项目库」新建一个，下次点一下就能加入今日 💡</div>';

    const allKeys = [
      ...SLOT_ORDER.map((slot) => "meal:" + slot + ":" + meals[slot].name),
      ...ex.map((e) => "ex:" + e.name),
      ...ci.customEx.map((c) => "exC:" + c.id),
    ];
    const doneCount = allKeys.filter((k) => ci.done[k]).length;
    diet.planDone.textContent = doneCount + "/" + allKeys.length;

    if (diet.weekPlan && diet.weekPlan.style.display !== "none") {
      renderWeekPlan(dateStr);
    }

    $$("#mealList .meal-toggle").forEach((b) =>
      b.addEventListener("click", () => {
        const d = planDate();
        const c = state.checkins[d] || (state.checkins[d] = { done: {}, customEx: [] });
        c.done[b.dataset.key] = !c.done[b.dataset.key];
        saveAll(); renderPlan(d);
      })
    );
    $$("#mealList .meal-video").forEach((b) =>
      b.addEventListener("click", () => {
        window.open(bili(b.dataset.kw + " 视频"), "_blank", "noopener");
      })
    );
    $$("#mealList .meal-detail-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const box = $("#meal-detail-" + b.dataset.slot + "-" + dateStr);
        if (!box) return;
        const show = box.style.display === "none";
        box.style.display = show ? "block" : "none";
        b.textContent = show ? "👆 收起" : "👩‍🍳 做法";
      })
    );
    $$("#mealList .meal-shuffle").forEach((b) =>
      b.addEventListener("click", () => {
        const d = planDate();
        const c = state.checkins[d] || (state.checkins[d] = { done: {}, customEx: [] });
        if (!c.meals || !c.meals.breakfast) c.meals = getDefaultMeals(d);
        if (!c.shuffleCount) c.shuffleCount = {};
        const slot = b.dataset.slot;
        c.shuffleCount[slot] = (c.shuffleCount[slot] || 0) + 1;
        const seed = d + ":" + slot + ":" + c.shuffleCount[slot];
        const m = pickDaily(MEALS[slot], seed, 1)[0];
        c.meals[slot] = { ...m, slot, slotLabel: SLOT_LABELS[slot] };
        saveAll(); renderPlan(d);
      })
    );
    $$("#exList .check-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const d = planDate();
        const c = state.checkins[d] || (state.checkins[d] = { done: {}, customEx: [] });
        c.done[b.dataset.key] = !c.done[b.dataset.key];
        saveAll(); renderPlan(d);
      })
    );
    $$("#exList .ex-del").forEach((b) =>
      b.addEventListener("click", () => {
        const d = planDate();
        const c = state.checkins[d];
        if (c) c.customEx = c.customEx.filter((x) => x.id !== b.dataset.id);
        saveAll(); renderPlan(d);
      })
    );
    $$("#exLibList .ex-lib-add").forEach((b) =>
      b.addEventListener("click", () => {
        const d = planDate();
        const c = state.checkins[d] || (state.checkins[d] = { done: {}, customEx: [] });
        if (!c.customEx) c.customEx = [];
        const item = (state.exLibrary || []).find((x) => x.id === b.dataset.id);
        if (item && !c.customEx.some((x) => x.id === item.id)) c.customEx.push(item);
        saveAll(); renderPlan(d);
      })
    );
    $$("#exLibList .ex-del").forEach((b) =>
      b.addEventListener("click", () => {
        state.exLibrary = (state.exLibrary || []).filter((x) => x.id !== b.dataset.id);
        const d = planDate();
        const c = state.checkins[d];
        if (c && c.customEx) c.customEx = c.customEx.filter((x) => x.id !== b.dataset.id);
        saveAll(); renderPlan(d);
      })
    );
  }

  function exCard(e, key, ci, isCustom) {
    const done = !!ci.done[key];
    const kw = e.kw || e.name + " 运动";
    const tag = e.cat ? '<span class="ex-cat">' + escapeHtml(e.cat) + '</span>' : "";
    return `<div class="ex-card${done ? " done" : ""}">
      <button class="check-btn" data-key="${key}">${done ? "✓" : ""}</button>
      <div class="ex-emoji">${e.emoji || "🏃"}</div>
      <div class="ex-main">
        <div class="ex-name">${escapeHtml(e.name)} ${tag}</div>
        <div class="ex-min">约 ${e.min} 分钟</div>
      </div>
      ${isCustom ? `<button class="ex-del" data-id="${e.id}" title="从今日移除">✕</button>` : ""}
      <a class="ex-link" href="${bili(kw)}" target="_blank" rel="noopener">▶ 跟练</a>
    </div>`;
  }

  function libCard(item, inToday) {
    const kw = item.kw || item.name + " 运动";
    const tag = item.cat ? '<span class="ex-cat">' + escapeHtml(item.cat) + '</span>' : "";
    return `<div class="ex-lib-card">
      <div class="ex-emoji">${item.emoji || "🏃"}</div>
      <div class="ex-main">
        <div class="ex-name">${escapeHtml(item.name)} ${tag}</div>
        <div class="ex-min">约 ${item.min || 0} 分钟</div>
      </div>
      ${inToday
        ? '<span class="ex-lib-added">✓ 已加入今日</span>'
        : `<button class="ex-lib-add" data-id="${item.id}">＋ 加入今日</button>`}
      <button class="ex-del" data-id="${item.id}" title="从项目库删除">✕</button>
    </div>`;
  }

  function formatDateLocal(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function renderWeekPlan(dateStr) {
    if (!diet.weekPlan) return;
    const base = new Date(dateStr + "T00:00:00");
    const dow = base.getDay(); // 0=周日 .. 6=周六
    const mondayOffset = (dow === 0 ? -6 : 1 - dow);
    const monday = new Date(base); monday.setDate(base.getDate() + mondayOffset);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      days.push(formatDateLocal(d));
    }
    const wdNames = ["日", "一", "二", "三", "四", "五", "六"];
    const html = days.map((d) => {
      const ci = state.checkins[d];
      let ms = ci && ci.meals ? ci.meals : getDefaultMeals(d);
      const total = SLOT_ORDER.reduce((sum, slot) => sum + ((ms[slot] && ms[slot].kcal) || 0), 0);
      const active = d === dateStr ? " active" : "";
      const firstMeal = ms.breakfast && ms.breakfast.name ? ms.breakfast.name.slice(0, 6) : "";
      const ex = pickDaily(EXERCISES, d, 1)[0];
      const wd = wdNames[new Date(d + "T00:00:00").getDay()];
      return `<div class="week-day${active}" data-date="${d}">
        <div class="week-date">周${wd}</div>
        <div class="week-kcal">${total}k</div>
        <div class="week-meal">${escapeHtml(firstMeal)}</div>
        <div class="week-ex">${ex.emoji}${escapeHtml(ex.name.slice(0, 4))}</div>
      </div>`;
    }).join("");
    diet.weekPlan.innerHTML = '<div class="week-hint">← 左右滑动查看整周 →</div><div class="week-grid">' + html + '</div>';
    const grid = diet.weekPlan.querySelector(".week-grid");
    const activeEl = diet.weekPlan.querySelector(".week-day.active");
    if (grid && activeEl) {
      const gr = grid.getBoundingClientRect();
      const ar = activeEl.getBoundingClientRect();
      grid.scrollLeft += (ar.left + ar.width / 2) - (gr.left + gr.width / 2);
    }
    $$("#weekPlan .week-day").forEach((el) =>
      el.addEventListener("click", () => {
        const d = el.dataset.date;
        if (diet.foodDate) diet.foodDate.value = d;
        renderPlan(d);
      })
    );
  }

  function renderDiet() {
    const ws = [...state.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!ws.length) {
      diet.cur.textContent = "—"; diet.lost.textContent = "—"; diet.goal.textContent = state.goal || "—";
      diet.remain.textContent = "—"; diet.percent.textContent = "0%"; diet.bar.style.width = "0%";
      diet.empty.style.display = "block"; diet.list.innerHTML = "";
      diet.chart.innerHTML = ""; return;
    }
    diet.empty.style.display = "none";
    const first = ws[0].weight;
    const cur = ws[ws.length - 1].weight;
    diet.cur.textContent = cur;
    diet.goal.textContent = state.goal || "—";
    if (state.goal && first > state.goal) {
      const lost = Math.max(0, first - cur);
      const total = first - state.goal;
      diet.lost.textContent = lost.toFixed(1);
      const pct = Math.max(0, Math.min(100, (lost / total) * 100));
      diet.percent.textContent = pct.toFixed(0) + "%";
      diet.bar.style.width = pct + "%";
      const remainKg = Math.max(0, cur - state.goal);
      const days = Math.max(0, Math.ceil((remainKg / 0.5) * 7));
      diet.remain.textContent = remainKg > 0 ? `${days}天` : "达成🎉";
    } else {
      diet.lost.textContent = (first - cur).toFixed(1);
      diet.percent.textContent = "—"; diet.bar.style.width = "0%"; diet.remain.textContent = "—";
    }
    drawLine(ws);
    diet.list.innerHTML = [...ws].reverse().map((w) =>
      `<li>
        <div class="rec-icon" style="background:#d8f5ec">⚖️</div>
        <div class="rec-main">
          <div class="rec-cat">${w.weight} kg</div>
          <div class="rec-note">${w.note || w.date}</div>
        </div>
        <span class="rec-date">${w.date.slice(5)}</span>
        <button class="rec-del" data-id="${w.id}">🗑️</button>
      </li>`).join("");
    $$(".rec-del", diet.list).forEach((b) =>
      b.addEventListener("click", () => {
        state.weights = state.weights.filter((x) => x.id !== b.dataset.id);
        saveAll(); renderDiet();
      })
    );
  }

  function drawLine(ws) {
    const W = 320, H = 200, padL = 36, padR = 12, padT = 16, padB = 28;
    const vals = ws.map((w) => w.weight);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.15; max += span * 0.15;
    const x = (i) => padL + (i * (W - padL - padR)) / (ws.length - 1 || 1);
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    let svg = "";
    for (let g = 0; g <= 3; g++) {
      const gy = padT + (g * (H - padT - padB)) / 3;
      const val = max - (g * (max - min)) / 3;
      svg += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#ffe1ec" stroke-width="1"/>`;
      svg += `<text x="${padL - 4}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#a08a98">${val.toFixed(1)}</text>`;
    }
    const pts = ws.map((w, i) => `${x(i)},${y(w.weight)}`).join(" ");
    svg += `<polyline points="${pts}" fill="none" stroke="#54c7b3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    ws.forEach((w, i) => {
      svg += `<circle cx="${x(i)}" cy="${y(w.weight)}" r="4" fill="#fff" stroke="#54c7b3" stroke-width="2.5"/>`;
      if (i === 0 || i === ws.length - 1 || ws.length <= 6)
        svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#a08a98">${w.date.slice(5)}</text>`;
    });
    diet.chart.innerHTML = svg;
  }

  $("#weightForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const w = parseFloat($("#wWeightInput").value);
    if (!(w > 0)) return;
    state.weights.push({ id: uid(), date: $("#wDateInput").value || todayStr(), weight: w, note: $("#wNoteInput").value.trim() });
    saveAll();
    $("#wWeightInput").value = ""; $("#wNoteInput").value = "";
    renderDiet();
    renderPlan(diet.foodDate.value || todayStr());
  });
  $("#saveGoalBtn").addEventListener("click", () => {
    const g = parseFloat($("#goalInput").value);
    state.goal = g > 0 ? g : null;
    saveAll(); renderDiet();
  });

  /* ----- 身材信息弹窗 ----- */
  const profileModal = $("#profileModal");
  $("#editProfileBtn").addEventListener("click", () => {
    const p = state.profile || {};
    $("#pSex").value = p.sex || "f";
    $("#pHeight").value = p.height || "";
    $("#pAge").value = p.age || "";
    $("#pActivity").value = String(p.activity || 1.375);
    $("#pWeight").value = p.weight || currentWeight() || "";
    profileModal.classList.add("show");
  });
  $("#profileCancel").addEventListener("click", () => profileModal.classList.remove("show"));
  $("#profileSave").addEventListener("click", () => {
    const profile = {
      sex: $("#pSex").value,
      height: parseFloat($("#pHeight").value) || null,
      age: parseFloat($("#pAge").value) || null,
      activity: parseFloat($("#pActivity").value) || 1.375,
      weight: parseFloat($("#pWeight").value) || null,
    };
    if (!profile.height || !profile.age) { alert("请填写身高和年龄～"); return; }
    state.profile = profile;
    saveAll(); profileModal.classList.remove("show");
    renderDiet(); renderPlan(diet.foodDate.value || todayStr());
  });

  /* ----- 饮食拍照记录（IndexedDB 存图） ----- */
  const DB_NAME = "wbPhotos", STORE = "photos";
  let _db = null;
  function openDB() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
      r.onsuccess = () => { _db = r.result; res(_db); };
      r.onerror = () => rej(r.error);
    });
  }
  async function dbAdd(photo) {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(photo);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
  async function dbByDate(date) {
    const db = await openDB();
    return new Promise((res) => {
      const out = [];
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = (e) => {
        const c = e.target.result;
        if (c) { if (c.value.date === date) out.push(c.value); c.continue(); } else res(out);
      };
      req.onerror = () => res([]);
    });
  }
  async function dbDel(id) {
    const db = await openDB();
    await new Promise((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res;
    });
  }
  async function dbGetAll() {
    const db = await openDB();
    return new Promise((res) => {
      const out = [];
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = (e) => {
        const c = e.target.result;
        if (c) { out.push(c.value); c.continue(); } else res(out);
      };
      req.onerror = () => res([]);
    });
  }
  async function dbClearAll() {
    const db = await openDB();
    await new Promise((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = res;
    });
  }
  function resizeImage(file, maxDim, quality) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
          const c = document.createElement("canvas");
          c.width = img.width * scale; c.height = img.height * scale;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", quality));
        };
        img.onerror = rej; img.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }

  async function renderFood(dateStr) {
    let photos = [];
    try { photos = await dbByDate(dateStr); } catch (e) { photos = []; }
    if (!photos.length) {
      diet.foodGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#a08a98;font-size:13px;padding:14px 0">这天还没拍照哦 📷</div>`;
      return;
    }
    diet.foodGrid.innerHTML = photos.map((p) =>
      `<div class="food-thumb" data-id="${p.id}">
        <img src="${p.dataUrl}" alt="饮食" />
        <button class="ft-del" data-id="${p.id}">✕</button>
      </div>`).join("");
    $$(".food-thumb", diet.foodGrid).forEach((t) => {
      t.addEventListener("click", (e) => {
        if (e.target.classList.contains("ft-del")) return;
        openPhoto(t.dataset.id, photos);
      });
    });
    $$(".ft-del", diet.foodGrid).forEach((b) =>
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        await dbDel(b.dataset.id);
        renderFood(diet.foodDate.value);
      })
    );
  }
  let _viewPhotos = [];
  function openPhoto(id, photos) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    _viewPhotos = photos;
    $("#photoBig").src = p.dataUrl;
    $("#photoNote").textContent = p.note || "（无备注）";
    $("#photoModal").dataset.id = id;
    $("#photoModal").classList.add("show");
  }
  $("#photoClose").addEventListener("click", () => $("#photoModal").classList.remove("show"));
  $("#photoDelete").addEventListener("click", async () => {
    const id = $("#photoModal").dataset.id;
    await dbDel(id);
    $("#photoModal").classList.remove("show");
    renderFood(diet.foodDate.value);
  });

  diet.foodDate.addEventListener("change", () => {
    renderFood(diet.foodDate.value);
    renderPlan(diet.foodDate.value);
  });
  diet.foodPhoto.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dateStr = diet.foodDate.value || todayStr();
    const dataUrl = await resizeImage(file, 1000, 0.7);
    await dbAdd({ id: uid(), date: dateStr, dataUrl, note: "" });
    diet.foodPhoto.value = "";
    renderFood(dateStr);
  });

  /* ----- 自定义运动 ----- */
  $("#addExBtn").addEventListener("click", () => $("#exAddForm").classList.add("show"));
  $("#exAddConfirm").addEventListener("click", () => {
    const name = $("#exNameInput").value.trim();
    const min = parseInt($("#exMinInput").value, 10) || 0;
    if (!name) { alert("请输入运动名称"); return; }
    const d = planDate();
    const ci = state.checkins[d] || (state.checkins[d] = { done: {}, customEx: [] });
    if (!ci.customEx) ci.customEx = [];
    if (!state.exLibrary) state.exLibrary = [];
    const item = { id: uid(), name, emoji: "🏃", min, cat: "我的" };
    if (!state.exLibrary.some((x) => x.name === name)) state.exLibrary.push(item);
    if (!ci.customEx.some((x) => x.id === item.id)) ci.customEx.push(item);
    saveAll();
    $("#exNameInput").value = ""; $("#exMinInput").value = "";
    $("#exAddForm").classList.remove("show");
    renderPlan(d);
  });

  /* =========================================================
     烘焙模块
     ========================================================= */
  const recipeGrid = $("#recipeGrid");

  /* ----- 每日烘焙视频推荐 ----- */
  const BAKE_CATS = [
    { key: "bread",   name: "面包", emoji: "🍞" },
    { key: "cake",    name: "蛋糕", emoji: "🍰" },
    { key: "cookie",  name: "饼干", emoji: "🍪" },
    { key: "drink",   name: "饮品", emoji: "🥤" },
    { key: "dessert", name: "甜点", emoji: "🍮" },
    { key: "pastry",  name: "酥点", emoji: "🥐" },
  ];
  // 每个品类一组视频主题，每天确定性推荐 8 个（即每类全部配方）；每条带图文步骤（steps 可加用户照片）
  const BAKE_POOL = {
    bread: [
      { name: "松软吐司面包", kw: "吐司面包 做法 家庭版", emoji: "🍞", steps: [
        { text: "高筋面粉300g、牛奶160g、鸡蛋1个、糖30g、盐3g、酵母3g、黄油25g混合揉面" },
        { text: "揉到光滑后加黄油，继续揉出手套膜" },
        { text: "盖保鲜膜一次发酵至2倍大，约60分钟" },
        { text: "排气分割滚圆，松弛15分钟" },
        { text: "整形入模，二次发酵到8分满" },
        { text: "烤箱180度烤30分钟，出炉立即脱模" },
      ]},
      { name: "法式可颂", kw: "可颂 做法 千层", emoji: "🥐", steps: [
        { text: "面团包入黄油片，三折两次并冷藏松弛" },
        { text: "擀开再三折，重复3次形成千层" },
        { text: "整形为牛角状，发酵至蓬松" },
        { text: "表面刷蛋液" },
        { text: "烤箱200度烤18分钟至金黄" },
      ]},
      { name: "麻薯软欧包", kw: "软欧包 麻薯 做法", emoji: "🥖", steps: [
        { text: "麻薯：糯米粉、牛奶、糖混合蒸成麻薯" },
        { text: "主面团揉好，一次发酵" },
        { text: "包入麻薯和馅料" },
        { text: "割包，二次发酵" },
        { text: "烤箱190度烤25分钟" },
      ]},
      { name: "北海道牛奶面包", kw: "北海道 牛奶面包 做法", emoji: "🍞", steps: [
        { text: "汤种：面粉+牛奶小火煮至糊状，放凉" },
        { text: "主面团加汤种揉出薄膜" },
        { text: "一次发酵后分割松弛" },
        { text: "整形入模，二次发酵" },
        { text: "烤箱170度烤30分钟" },
      ]},
      { name: "贝果 Bagel", kw: "贝果 做法 煮", emoji: "🥯", steps: [
        { text: "面团揉好松弛" },
        { text: "整形成圈，发酵20分钟" },
        { text: "糖水里每面煮30秒" },
        { text: "表面撒装饰" },
        { text: "烤箱200度烤18分钟" },
      ]},
      { name: "全麦养生面包", kw: "全麦面包 做法 无糖", emoji: "🌾", steps: [
        { text: "全麦粉+高筋粉+酵母+水揉面" },
        { text: "加入坚果果干拌匀" },
        { text: "一次发酵" },
        { text: "整形二次发酵" },
        { text: "烤箱180度烤35分钟" },
      ]},
      { name: "肉桂卷", kw: "肉桂卷 做法 拉丝", emoji: "🌀", steps: [
        { text: "面团发酵好擀成长方形" },
        { text: "抹黄油，撒肉桂糖" },
        { text: "卷起切段" },
        { text: "二次发酵" },
        { text: "烤箱180度烤20分钟，淋糖霜" },
      ]},
      { name: "碱水结面包", kw: "碱水面包 做法 德式", emoji: "🥨", steps: [
        { text: "面团整形为蝴蝶结" },
        { text: "冷藏松弛" },
        { text: "烘焙碱水里泡30秒（戴手套）" },
        { text: "划口撒盐" },
        { text: "烤箱220度烤15分钟" },
      ]},
    ],
    cake: [
      { name: "戚风蛋糕", kw: "戚风蛋糕 做法 不塌", emoji: "🍰", steps: [
        { text: "蛋黄+油+奶+面粉拌成蛋黄糊" },
        { text: "蛋白加糖打发至硬性发泡" },
        { text: "翻拌混合，倒入模具震出气泡" },
        { text: "烤箱150度烤50分钟" },
        { text: "出炉倒扣放凉再脱模" },
      ]},
      { name: "巴斯克芝士蛋糕", kw: "巴斯克 芝士蛋糕 做法", emoji: "🧀", steps: [
        { text: "奶油奶酪软化加糖打匀" },
        { text: "加鸡蛋、淡奶油、低粉拌匀" },
        { text: "倒入模具" },
        { text: "烤箱220度烤25分钟至表面焦化" },
        { text: "冷藏4小时口感更佳" },
      ]},
      { name: "草莓奶油蛋糕", kw: "草莓 奶油蛋糕 裱花", emoji: "🍓", steps: [
        { text: "蛋糕片分三层" },
        { text: "打发淡奶油" },
        { text: "一层蛋糕一层奶油草莓叠放" },
        { text: "整体抹面裱花" },
        { text: "装饰草莓，冷藏定型" },
      ]},
      { name: "古早味蛋糕", kw: "古早味蛋糕 做法 水浴", emoji: "🍮", steps: [
        { text: "热油烫面" },
        { text: "加蛋黄、牛奶拌匀" },
        { text: "蛋白打发后翻拌" },
        { text: "水浴法150度烤60分钟" },
      ]},
      { name: "千层蛋糕", kw: "千层蛋糕 做法 班戟", emoji: "🥞", steps: [
        { text: "摊班戟皮约20张" },
        { text: "打发奶油" },
        { text: "一层皮一层奶油叠放" },
        { text: "冷藏定型后切块" },
      ]},
      { name: "巧克力熔岩蛋糕", kw: "熔岩蛋糕 做法 流心", emoji: "🍫", steps: [
        { text: "巧克力+黄油隔水融化" },
        { text: "加鸡蛋、糖打匀，拌入低粉" },
        { text: "倒入模具" },
        { text: "烤箱200度烤9分钟（流心）" },
        { text: "脱模筛糖粉" },
      ]},
      { name: "抹茶慕斯蛋糕", kw: "抹茶 慕斯 做法", emoji: "🍵", steps: [
        { text: "饼干底压碎铺底压实" },
        { text: "抹茶+奶油+吉利丁煮化" },
        { text: "倒入模具冷藏4小时" },
        { text: "脱模装饰" },
      ]},
      { name: "红丝绒蛋糕", kw: "红丝绒 蛋糕 做法", emoji: "❤️", steps: [
        { text: "红曲粉+可可+面粉混合" },
        { text: "黄油、糖、蛋、奶拌匀" },
        { text: "烤蛋糕片" },
        { text: "奶酪霜抹面，冷藏" },
      ]},
    ],
    cookie: [
      { name: "黄油曲奇", kw: "黄油曲奇 做法 挤花", emoji: "🍪", steps: [
        { text: "黄油软化加糖打发" },
        { text: "加蛋液、低粉拌匀" },
        { text: "挤花成型" },
        { text: "烤箱170度烤15分钟" },
      ]},
      { name: "蔓越莓饼干", kw: "蔓越莓 饼干 做法", emoji: "🍪", steps: [
        { text: "黄油、糖打发，加蛋液" },
        { text: "加低粉和蔓越莓拌匀" },
        { text: "整形成长条，冷冻1小时" },
        { text: "切片" },
        { text: "烤箱170度烤18分钟" },
      ]},
      { name: "玛格丽特饼干", kw: "玛格丽特 饼干 做法", emoji: "🌼", steps: [
        { text: "煮蛋黄过筛" },
        { text: "黄油、糖打发，加粉类" },
        { text: "揉团冷藏" },
        { text: "按出裂纹" },
        { text: "烤箱160度烤15分钟" },
      ]},
      { name: "芝麻薄脆", kw: "芝麻 薄脆 做法", emoji: "⚪", steps: [
        { text: "蛋白+糖+油拌匀" },
        { text: "加低粉、芝麻" },
        { text: "摊薄" },
        { text: "烤箱160度烤12分钟" },
      ]},
      { name: "巧克力豆软曲奇", kw: "巧克力豆 曲奇 软", emoji: "🍫", steps: [
        { text: "黄油、糖打发，加蛋" },
        { text: "加粉类和巧克力豆" },
        { text: "团成球" },
        { text: "烤箱180度烤12分钟（软心）" },
      ]},
      { name: "猫爪饼干", kw: "猫爪 饼干 造型", emoji: "🐾", steps: [
        { text: "原味+巧克力面团各一份" },
        { text: "压出猫爪造型" },
        { text: "冷冻定型" },
        { text: "烤箱160度烤15分钟" },
      ]},
      { name: "燕麦能量饼干", kw: "燕麦 能量 饼干 做法", emoji: "🌾", steps: [
        { text: "香蕉泥+燕麦+坚果拌匀" },
        { text: "团成球压扁" },
        { text: "烤箱170度烤18分钟" },
      ]},
      { name: "糖霜字母饼干", kw: "糖霜 饼干 装饰 做法", emoji: "✨", steps: [
        { text: "黄油饼干烤好放凉" },
        { text: "蛋白糖霜调色" },
        { text: "挤字装饰，晾干" },
      ]},
    ],
    drink: [
      { name: "脏脏奶茶", kw: "脏脏奶茶 做法 黑糖", emoji: "🥤", steps: [
        { text: "黑糖熬煮挂杯壁" },
        { text: "煮珍珠" },
        { text: "泡茶加奶" },
        { text: "组合，刮下黑糖搅匀" },
      ]},
      { name: "草莓奶昔", kw: "草莓 奶昔 做法", emoji: "🍓", steps: [
        { text: "草莓冷冻" },
        { text: "加酸奶/冰淇淋打匀" },
        { text: "杯壁装饰草莓" },
      ]},
      { name: "抹茶拿铁", kw: "抹茶 拿铁 做法", emoji: "🍵", steps: [
        { text: "抹茶粉过筛加热水化开" },
        { text: "牛奶打泡" },
        { text: "组合，撒抹茶粉" },
      ]},
      { name: "杨枝甘露", kw: "杨枝甘露 做法 芒果", emoji: "🥭", steps: [
        { text: "芒果、西米、西柚处理" },
        { text: "芒果打成浆" },
        { text: "组合冷藏" },
      ]},
      { name: "桂花酒酿圆子", kw: "桂花 酒酿 圆子 做法", emoji: "🌼", steps: [
        { text: "小圆子煮熟" },
        { text: "酒酿、桂花煮开" },
        { text: "组合，撒干桂花" },
      ]},
      { name: "柠檬气泡水", kw: "柠檬 气泡水 做法", emoji: "🍋", steps: [
        { text: "柠檬、蜂蜜打底" },
        { text: "加气泡水" },
        { text: "加冰" },
      ]},
      { name: "红豆芋泥奶茶", kw: "红豆 芋泥 奶茶 做法", emoji: "🟣", steps: [
        { text: "芋头蒸成泥" },
        { text: "煮红豆" },
        { text: "加奶茶组合" },
      ]},
      { name: "焦糖玛奇朵", kw: "焦糖玛奇朵 做法 在家", emoji: "☕", steps: [
        { text: "熬焦糖" },
        { text: "萃取咖啡" },
        { text: "加奶泡，淋焦糖" },
      ]},
    ],
    dessert: [
      { name: "葡式蛋挞", kw: "蛋挞 做法 酥皮", emoji: "🥧", steps: [
        { text: "酥皮整入蛋挞模" },
        { text: "蛋液（蛋+奶+糖）倒入8分满" },
        { text: "烤箱220度烤20分钟" },
      ]},
      { name: "芒果布丁", kw: "芒果 布丁 做法", emoji: "🍮", steps: [
        { text: "芒果泥+吉利丁+奶煮化" },
        { text: "倒入杯中冷藏" },
        { text: "装饰芒果粒" },
      ]},
      { name: "舒芙蕾松饼", kw: "舒芙蕾 松饼 做法", emoji: "🥞", steps: [
        { text: "蛋白打发" },
        { text: "拌入蛋黄糊" },
        { text: "小火煎，盖盖焖熟" },
      ]},
      { name: "焦糖布蕾", kw: "焦糖 布蕾 做法 烤", emoji: "🍮", steps: [
        { text: "蛋奶液过筛" },
        { text: "水浴150度烤40分钟" },
        { text: "撒糖用火枪焦化" },
      ]},
      { name: "双皮奶", kw: "双皮奶 做法 广式", emoji: "🥛", steps: [
        { text: "全脂奶煮出奶皮" },
        { text: "加蛋清、糖回倒" },
        { text: "蒸10分钟，放凉" },
      ]},
      { name: "提拉米苏", kw: "提拉米苏 做法 免烤", emoji: "🍫", steps: [
        { text: "手指饼蘸咖啡酒" },
        { text: "铺马斯卡彭芝士层" },
        { text: "叠层冷藏，撒可可粉" },
      ]},
      { name: "麻薯蛋黄酥", kw: "蛋黄酥 做法 麻薯", emoji: "🌕", steps: [
        { text: "准备金沙馅和麻薯" },
        { text: "包入酥皮" },
        { text: "刷蛋液，烤箱烤" },
      ]},
      { name: "雪花酥", kw: "雪花酥 做法 牛轧糖", emoji: "❄️", steps: [
        { text: "棉花糖、黄油融化" },
        { text: "加饼干、坚果拌匀" },
        { text: "整形切块" },
      ]},
    ],
    pastry: [
      { name: "蛋黄酥", kw: "蛋黄酥 做法 层层", emoji: "🌕", steps: [
        { text: "油皮、油酥分别揉好" },
        { text: "包酥松弛" },
        { text: "包入豆沙和咸蛋黄" },
        { text: "刷蛋液" },
        { text: "烤箱180度烤30分钟" },
      ]},
      { name: "苹果派", kw: "苹果派 做法 酥皮", emoji: "🥧", steps: [
        { text: "酥皮铺底" },
        { text: "铺苹果馅" },
        { text: "盖酥皮割口" },
        { text: "烤箱烤至金黄" },
      ]},
      { name: "泡芙", kw: "泡芙 做法 卡仕达", emoji: "🍥", steps: [
        { text: "水、油、面粉煮成糊" },
        { text: "加蛋拌匀" },
        { text: "挤形烤" },
        { text: "灌入奶油" },
      ]},
      { name: "蝴蝶酥", kw: "蝴蝶酥 做法 折叠", emoji: "🦋", steps: [
        { text: "酥皮裹糖" },
        { text: "折叠卷起" },
        { text: "切片烤" },
      ]},
      { name: "蛋卷", kw: "蛋卷 做法 脆", emoji: "🌀", steps: [
        { text: "蛋液+粉+油拌匀" },
        { text: "摊成薄片" },
        { text: "趁热卷起" },
      ]},
      { name: "芝麻瓦片", kw: "芝麻 瓦片 做法", emoji: "⚪", steps: [
        { text: "蛋白、芝麻、糖拌匀" },
        { text: "摊薄" },
        { text: "烤箱烤脆" },
      ]},
      { name: "千层酥条", kw: "千层酥 做法 酥条", emoji: "🥐", steps: [
        { text: "酥皮叠层" },
        { text: "切条扭转" },
        { text: "烤至起层" },
      ]},
      { name: "老婆饼", kw: "老婆饼 做法 糯米", emoji: "🌾", steps: [
        { text: "炒糯米馅" },
        { text: "包入酥皮" },
        { text: "刷蛋液撒芝麻，烤" },
      ]},
    ],
  };
  let bakeCurCat = "bread";
  const bakeCatsEl = $("#bakeCats");
  const bakeVideosEl = $("#bakeVideos");

  function renderBakeCats() {
    bakeCatsEl.innerHTML = BAKE_CATS.map((c) =>
      `<div class="bake-cat${c.key === bakeCurCat ? " active" : ""}" data-key="${c.key}">
        <span class="bc-emoji">${c.emoji}</span>${c.name}
      </div>`).join("");
    $$(".bake-cat", bakeCatsEl).forEach((el) =>
      el.addEventListener("click", () => {
        bakeCurCat = el.dataset.key;
        renderBakeCats(); renderBakeVideos();
      })
    );
  }

  function renderBakeVideos() {
    const d = todayStr();
    const seed = state.bakeSeeds[d] || 0;
    const picks = pickDaily(BAKE_POOL[bakeCurCat], d + "#" + seed, 8);
    const cat = BAKE_CATS.find((c) => c.key === bakeCurCat);
    $("#bakeDate").textContent = `📅 ${d} · ${cat.name}推荐`;
    bakeVideosEl.innerHTML = picks.map((v) => {
      const on = !!(state.favs[v.name] && state.favs[v.name].cols && state.favs[v.name].cols.length);
      const hasNote = !!(state.bakeNotes[v.name] && state.bakeNotes[v.name].steps && state.bakeNotes[v.name].steps.length);
      return `<div class="bake-video" data-name="${escapeHtml(v.name)}">
        <div class="bv-emoji">${v.emoji}</div>
        <div class="bv-main">
          <div class="bv-name">${escapeHtml(v.name)}</div>
          <div class="bv-kw">🔍 ${escapeHtml(v.kw)}</div>
        </div>
        <button class="bv-fav${on ? " on" : ""}" data-name="${escapeHtml(v.name)}" title="收藏">${on ? "♥" : "♡"}</button>
        <a class="bv-link" href="${bili(v.kw + " 教程")}" target="_blank" rel="noopener">📺 视频</a>
        <button class="bv-steps" data-name="${escapeHtml(v.name)}" title="查看图文步骤">👩‍🍳${hasNote ? "" : ""}</button>
      </div>`;
    }).join("");
    $$(".bv-fav", bakeVideosEl).forEach((btn) =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); openFavSheet(btn.dataset.name); })
    );
    $$(".bv-steps", bakeVideosEl).forEach((btn) =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); openBakeVideo(btn.dataset.name); })
    );
    $$(".bake-video", bakeVideosEl).forEach((card) =>
      card.addEventListener("click", (e) => {
        if (e.target.closest(".bv-link, .bv-fav, .bv-steps")) return;
        openBakeVideo(card.dataset.name);
      })
    );
  }

  /* ----- 推荐食谱图文详情 ----- */

  /* =========================================================
     热点小报模块（抖音热点每日简报）
     ========================================================= */
  const HOT_CATS = [
    {
      key: "parent", name: "亲子育儿", emoji: "👶",
      pool: [
        { topic: "宝宝第一口辅食怎么加", kw: "辅食添加 育儿", heat: "持续升温", angle: "拍「米糊到颗粒」的渐进过程，配对比图更直观", risk: "" },
        { topic: "职场宝妈的背奶日常", kw: "背奶 职场妈妈", heat: "稳定热度", angle: "记录通勤背包里的背奶装备清单", risk: "" },
        { topic: "二胎家庭的兄妹相处", kw: "二胎 家庭教育", heat: "持续升温", angle: "用真实对话切片展现手足情", risk: "" },
        { topic: "幼儿敏感期怎么引导", kw: "敏感期 早教", heat: "稳定热度", angle: "拆解蒙台梭利里的敏感期案例", risk: "" },
        { topic: "亲子游必去10个宝藏地", kw: "亲子游 亲子", heat: "即将降温", angle: "按季节推亲子目的地清单", risk: "" },
        { topic: "早教机构怎么选不踩坑", kw: "早教 避坑", heat: "稳定热度", angle: "做一张机构对比表更直观", risk: "涉及机构推广需标注「非广告」免责" },
        { topic: "宝宝夜醒频繁怎么办", kw: "婴儿睡眠 育儿", heat: "持续升温", angle: "睡前流程 vlog 最有代入感", risk: "" },
        { topic: "隔代养育的观念冲突", kw: "隔代养育 家庭", heat: "稳定热度", angle: "用两代人的对话展现差异", risk: "" },
      ],
    },
    {
      key: "work", name: "职场生活", emoji: "💼",
      pool: [
        { topic: "远程办公的居家效率", kw: "远程办公 效率", heat: "持续升温", angle: "晒你的桌面收纳与时间块", risk: "" },
        { topic: "项目经理的周报模板", kw: "周报 项目管理", heat: "稳定热度", angle: "给一套可直接抄的周报框架", risk: "" },
        { topic: "普通人的副业起步", kw: "副业 搞钱", heat: "持续升温", angle: "从 0 到 1 的第一单经验", risk: "" },
        { topic: "3分钟看懂财报", kw: "财报 干货", heat: "稳定热度", angle: "用一张图讲清三张表", risk: "" },
        { topic: "打工人续命咖啡图鉴", kw: "咖啡 打工", heat: "即将降温", angle: "按价位分层推荐豆单", risk: "" },
        { topic: "职场沟通的话术公式", kw: "沟通 职场", heat: "持续升温", angle: "录一段真实对接录音做拆解", risk: "" },
        { topic: "通勤时间的自我提升", kw: "通勤 学习", heat: "稳定热度", angle: "推荐 3 个碎片学习 APP", risk: "" },
        { topic: "裸辞后的第30天", kw: "裸辞 复盘", heat: "持续升温", angle: "用时间线记录心态变化", risk: "" },
      ],
    },
    {
      key: "fun", name: "综合泛娱乐", emoji: "🎬",
      pool: [
        { topic: "本周社会热搜盘点", kw: "热搜 社会", heat: "持续升温", angle: "按周做热搜回顾卡片", risk: "" },
        { topic: "租房收纳神器", kw: "收纳 好物", heat: "稳定热度", angle: "开箱种草最短路径", risk: "" },
        { topic: "剧情号前3秒套路", kw: "剧情号 短视频", heat: "持续升温", angle: "拆 3 个黄金开头钩子", risk: "" },
        { topic: "探店脚本模板", kw: "探店 美食", heat: "稳定热度", angle: "给老板一套可抄的探店词", risk: "" },
        { topic: "团购避坑指南", kw: "团购 本地生活", heat: "即将降温", angle: "用价格对比帮用户省钱", risk: "" },
        { topic: "国潮非遗年轻玩法", kw: "国潮 非遗", heat: "持续升温", angle: "非遗手作的过程记录", risk: "" },
        { topic: "影视二创版权边界", kw: "二创 版权", heat: "稳定热度", angle: "讲清「合理使用」红线", risk: "版权易踩线，需明确标注二创声明" },
        { topic: "搞笑反转短剧模板", kw: "短剧 反转", heat: "持续升温", angle: "前 3 秒钩子+结尾反转", risk: "" },
      ],
    },
  ];

  function seededShuffle(arr, seedStr) {
    // FNV-1a 32-bit 哈希，质量远高于原实现，避免相近字符串碰撞
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let seed = h >>> 0;
    const rand = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function hotPick(pool, dateStr, count) {
    return seededShuffle(pool, dateStr).slice(0, count);
  }

  function genDigest(dateStr, perCat, seed) {
    const s = seed ? dateStr + '#' + seed : dateStr;
    return HOT_CATS.map((c) => ({
      key: c.key, name: c.name, emoji: c.emoji,
      items: hotPick(c.pool, s, perCat),
    }));
  }

  /* 实时数据源：优先读取同源 hot-report.json（由每日定时任务/脚本生成）；拉不到则回退静态样例 */
  async function fetchReport(bust) {
    try {
      const url = "./hot-report.json" + (bust ? ("?t=" + Date.now()) : "");
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !Array.isArray(j.categories) || !j.categories.length) return null;
      return j;
    } catch (e) { return null; }
  }

  function hotToast(msg) {
    let t = document.getElementById("hotToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "hotToast";
      t.style.cssText = "position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:rgba(35,28,46,.86);color:#fff;padding:9px 18px;border-radius:22px;font-size:13px;z-index:9999;opacity:0;transition:opacity .25s;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.25)";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = "0"; }, 1600);
  }

  async function getHotCats(perCat, dateStr, seed) {
    const rep = await fetchReport(seed > 0);
    if (rep && Array.isArray(rep.categories) && rep.categories.length) {
      // 报告存在但日期不是今天 → 视为未每日刷新，回退「今日样例精选」（按日期确定性挑选，每天不同）
      if (rep.date && rep.date !== dateStr) {
        return { categories: genDigest(dateStr, perCat, seed), trend: null, fromReport: false, stale: rep.date };
      }
      // 报告是今天的：用 seed 重排条目顺序，让「重新生成/刷新」点击后产生可见变化
      const cats = rep.categories.map((c) => ({
        key: c.key, name: c.name, emoji: c.emoji,
        items: seededShuffle(c.items && c.items.length ? c.items : [], dateStr + '#' + (seed || 0)),
      }));
      return { categories: cats, trend: rep.trend || null, fromReport: true };
    }
    return { categories: genDigest(dateStr, perCat, seed), trend: null, fromReport: false };
  }

  function renderHotTrendFromReport(trend, perCat) {
    const li = (arr) => (arr && arr.length ? arr.map((t) => '<li>' + escapeHtml(t) + '</li>').join("") : '<li>—</li>');
    return '<div class="hot-trend">' +
      '<div class="hot-trend-title">📈 今日流量趋势总结</div>' +
      '<p>' + escapeHtml(trend.summary || "") + '</p>' +
      '<p class="hot-trend-stats"><b class="t-first">优先拍 ' + (trend.first || 0) + '</b> · <b class="t-second">次优先 ' + (trend.second || 0) + '</b> · <b class="t-backup">备选 ' + (trend.backup || 0) + '</b>（共 ' + (trend.total || 0) + ' 条可借势）</p>' +
      '<div class="hot-trend-cols">' +
        '<div class="hot-trend-col"><div class="hot-trend-col-h t-first">🔥 优先拍</div><ul>' + li(trend.firstTopics) + '</ul></div>' +
        '<div class="hot-trend-col"><div class="hot-trend-col-h t-second">⏳ 次优先</div><ul>' + li(trend.secondTopics) + '</ul></div>' +
        '<div class="hot-trend-col"><div class="hot-trend-col-h t-backup">🗂️ 备选</div><ul>' + li(trend.backupTopics) + '</ul></div>' +
      '</div>' +
      '<p class="hot-trend-note">当前每类显示 ' + (perCat || 8) + ' 条，可在上方「每板块条数」调整。</p>' +
      '</div>';
  }

  function renderHotTrend(list, perCat) {
    let first = 0, second = 0, backup = 0;
    list.forEach((c) => c.items.forEach((it) => {
      if (it.heat === "持续升温") first++;
      else if (it.heat === "稳定热度") second++;
      else backup++;
    }));
    const total = first + second + backup;
    return '<div class="hot-trend">' +
      '<div class="hot-trend-title">📈 今日流量趋势总结</div>' +
      '<p>共 ' + total + ' 条可借势热点：<b class="t-first">优先拍 ' + first + '</b> · <b class="t-second">次优先 ' + second + '</b> · <b class="t-backup">备选 ' + backup + '</b>。</p>' +
      '<p>「持续升温」类适合现在冲量，前3秒强钩子最容易起量；「稳定热度」可作常态化更新；「即将降温」建议尽快清掉库存选题。</p>' +
      '<p class="hot-trend-note">当前每类显示 ' + (perCat || 8) + ' 条，可在上方「每板块条数」调整。</p>' +
      '</div>';
  }

  function scriptTpl(topic, kw) {
    return "🎬 短视频脚本思路（" + topic + "）\n开头：用「" + kw + "」做钩子，3 秒内抓住注意力。\n中间：围绕「" + topic + "」展开，给观众一个可模仿的小技巧。\n结尾：引导点赞收藏，下期拆解同类选题。";
  }

  function renderHotBrief(list) {
    return list.map((c) => (
      '<div class="hot-cat" data-key="' + c.key + '">' +
        '<div class="hot-cat-head"><span class="hot-cat-emoji">' + c.emoji + '</span><h3>' + c.name + '</h3></div>' +
        '<div class="hot-items">' +
          c.items.map((it) => (
            '<div class="hot-item" data-topic="' + escapeHtml(it.topic) + '">' +
              '<div class="hot-item-topic">' + escapeHtml(it.topic) + '</div>' +
              '<div class="hot-item-meta">' +
                '<span class="hot-kw">🔑 ' + escapeHtml(it.kw) + '</span>' +
                '<span class="hot-heat hot-heat-' + it.heat + '">' + it.heat + '</span>' +
              '</div>' +
              '<div class="hot-item-angle">🎬 短视频切入点：' + escapeHtml(it.angle) + '</div>' +
              '<div class="hot-item-risk">' + (it.risk ? '⚠️ 风险提示：' + escapeHtml(it.risk) : '✅ 无敏感风险') + '</div>' +
              '<div class="hot-script">' + escapeHtml(scriptTpl(it.topic, it.kw)) + '</div>' +
            '</div>'
          )).join("") +
        '</div>' +
      '</div>'
    )).join("");
  }

  async function renderHot() { /* hotspot live */
    const dateStr = todayStr();
    const perCat = (state.hot && state.hot.perCat) || 8;
    const seed = (state.hot && state.hot.regenSeed) || 0;
    const res = await getHotCats(perCat, dateStr, seed);
    const list = res.categories;
    const trimmed = list.map((c) => ({ key: c.key, name: c.name, emoji: c.emoji, items: (c.items || []).slice(0, perCat) }));
    if (!state.hot) state.hot = {};
    if (!state.hot.history) state.hot.history = [];
    const snap = { date: dateStr, ts: Date.now(), topics: trimmed.map((c) => ({ name: c.name, emoji: c.emoji, first: (c.items[0] || {}).topic })) };
    const hi = state.hot.history.findIndex((h) => h.date === dateStr);
    if (hi >= 0) state.hot.history[hi] = snap; else state.hot.history.push(snap);
    const staleNote = (res.stale) ? '<div class="hot-stale-note">⚠️ 自动报告最近更新于 ' + res.stale + '，可能未按日刷新；以下为「今日样例精选」（按日期每天不同），仅供灵感参考。</div>' : '';
    $("#hotBrief").innerHTML = '<div class="hot-digest-head">【今日抖音热点简报 | ' + dateStr + '】</div>' + staleNote + renderHotBrief(trimmed);
    $("#hotChips").innerHTML = HOT_CATS.map((c) => '<button class="hot-chip" data-key="' + c.key + '">' + c.emoji + " " + escapeHtml(c.name) + '</button>').join("");
    $("#hotHistory").innerHTML = (state.hot.history || []).slice(-3).reverse().map((h) => '<div class="hot-hist-day"><div class="hot-hist-date">📅 ' + h.date + '</div>' + (h.topics || []).map((t) => '<div class="hot-hist-topic">' + t.emoji + ' ' + escapeHtml(t.first || '') + '</div>').join('') + '</div>').join('');
    $("#hotTrend").innerHTML = res.trend ? renderHotTrendFromReport(res.trend, perCat) : renderHotTrend(trimmed, perCat);

    const brief = $("#hotBrief");
    $$(".hot-item", brief).forEach((el) => {
      el.addEventListener("click", () => {
        const sc = el.querySelector(".hot-script");
        if (sc) sc.classList.toggle("show");
      });
    });
    $$("#hotChips .hot-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#hotChips .hot-chip").forEach((c) => c.classList.remove("on"));
        chip.classList.add("on");
        const key = chip.dataset.key;
        $$(".hot-cat", brief).forEach((cat) => {
          cat.style.display = (cat.dataset.key === key) ? "" : "none";
        });
      });
    });
    const first = $("#hotChips .hot-chip");
    if (first) first.classList.add("on");

    const pt = $("#hotPushTime"), pc = $("#hotPerCat");
    if (pt) {
      pt.value = (state.hot && state.hot.pushTime) || "08:30";
      pt.addEventListener("change", () => { state.hot.pushTime = pt.value; saveAll(); });
    }
    if (pc) {
      pc.value = (state.hot && state.hot.perCat) || 8;
      pc.addEventListener("change", async () => {
        const v = parseInt(pc.value, 10) || 8;
        state.hot.perCat = v; saveAll();
        const r2 = await getHotCats(v, todayStr());
        const t2 = r2.categories.map((c) => ({ key: c.key, name: c.name, emoji: c.emoji, items: (c.items || []).slice(0, v) }));
        const sn2 = (r2.stale) ? '<div class="hot-stale-note">⚠️ 自动报告最近更新于 ' + r2.stale + '，可能未按日刷新；以下为「今日样例精选」（按日期每天不同），仅供灵感参考。</div>' : '';
        $("#hotBrief").innerHTML = '<div class="hot-digest-head">【今日抖音热点简报 | ' + todayStr() + '】</div>' + sn2 + renderHotBrief(t2);
        $("#hotTrend").innerHTML = r2.trend ? renderHotTrendFromReport(r2.trend, v) : renderHotTrend(t2, v);
      });
    }
    const refreshBrief = async (btn) => {
      if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = "⏳ 生成中…"; }
      const v = (state.hot && state.hot.perCat) || 8;
      state.hot.regenSeed = ((state.hot && state.hot.regenSeed) || 0) + 1;
      saveAll();
      const r3 = await getHotCats(v, todayStr(), state.hot.regenSeed);
      const t3 = r3.categories.map((c) => ({ key: c.key, name: c.name, emoji: c.emoji, items: (c.items || []).slice(0, v) }));
      const sn3 = (r3.stale) ? '<div class="hot-stale-note">⚠️ 自动报告最近更新于 ' + r3.stale + '，可能未按日刷新；以下为「今日样例精选」（按日期每天不同），仅供灵感参考。</div>' : '';
      $("#hotBrief").innerHTML = '<div class="hot-digest-head">【今日抖音热点简报 | ' + todayStr() + '】</div>' + sn3 + renderHotBrief(t3);
      $("#hotTrend").innerHTML = r3.trend ? renderHotTrendFromReport(r3.trend, v) : renderHotTrend(t3, v);
      const snap3 = { date: todayStr(), ts: Date.now(), topics: t3.map((c) => ({ name: c.name, emoji: c.emoji, first: (c.items[0] || {}).topic })) };
      const hi3 = state.hot.history.findIndex((h) => h.date === todayStr());
      if (hi3 >= 0) state.hot.history[hi3] = snap3; else state.hot.history.push(snap3);
      saveAll();
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.orig || "🔄 重新生成今日简报"; }
      hotToast("已刷新今日简报 ✓");
    };
    $("#hotRegenerate").addEventListener("click", (e) => refreshBrief(e.currentTarget));
    $("#hotRefresh").addEventListener("click", (e) => refreshBrief(e.currentTarget));
    $("#hotHistoryBtn").addEventListener("click", () => {
      const box = $("#hotHistory");
      if (!box) return;
      if (box.dataset.open === "1") { box.style.display = "none"; box.dataset.open = "0"; return; }
      const snaps = (state.hot.history || []).slice(-3).reverse();
      box.innerHTML = snaps.map((s) => '<div class="hot-hist-day"><div class="hot-hist-date">📅 ' + s.date + '</div>' + (s.topics || []).map((t) => '<div class="hot-hist-topic">' + t.emoji + ' ' + escapeHtml(t.first || '') + '</div>').join('') + '</div>').join('') || '<div class="empty-hint">暂无记录</div>';
      box.style.display = "block"; box.dataset.open = "1";
    });
    const initHist = $("#hotHistory");
    if (initHist) { initHist.style.display = "none"; initHist.dataset.open = "0"; }
  }
  const bakeVideoModal = $("#bakeVideoModal");
  let currentBakeName = null;
  let currentBakeCatName = "烘焙";

  function openBakeVideo(name) {
    const v = findBakeVideo(name);
    if (!v) return;
    currentBakeName = name;
    // 以推荐步骤文本为基线，附上用户自己拍/传的图，存到 bakeNotes
    let note = state.bakeNotes[name];
    if (!note || !Array.isArray(note.steps) || !note.steps.length) {
      note = { steps: (v.steps || []).map((s) => ({ text: s.text || "", img: null })) };
      state.bakeNotes[name] = note;
    }
    const cat = BAKE_CATS.find((c) => BAKE_POOL[c.key].some((x) => x.name === name));
    currentBakeCatName = cat ? cat.name : "烘焙";
    $("#bvTitle").textContent = (v.emoji || "🧁") + " " + name;
    $("#bvMeta").textContent = "🍽️ 分类：" + (cat ? cat.name : "烘焙") + " · 共 " + note.steps.length + " 步";
    $("#bvWatch").href = bili(v.kw + " 教程");
    const on = !!(state.favs[name] && state.favs[name].cols && state.favs[name].cols.length);
    $("#bvFavBtn").textContent = on ? "♥ 已收藏" : "♡ 收藏";
    $("#bvFavBtn").classList.toggle("on", on);
    renderBakeVideoSteps();
    bakeVideoModal.classList.add("show");
  }

  function renderBakeVideoSteps() {
    const note = state.bakeNotes[currentBakeName];
    if (!note) { $("#bvSteps").innerHTML = `<div class="empty-hint">还没有步骤</div>`; return; }
    if (!note.steps.length) {
      $("#bvSteps").innerHTML = `<div class="empty-hint">还没有步骤，点下面「＋ 添加步骤」开始写～</div>
        <button type="button" class="mini-btn" id="bvAddStep">＋ 添加步骤</button>`;
      $("#bvAddStep").addEventListener("click", () => { note.steps.push({ text: "", img: null }); saveAll(); renderBakeVideoSteps(); });
      return;
    }
    $("#bvSteps").innerHTML = note.steps.map((s, i) =>
      `<div class="rv-step">
        <div class="rv-step-num">${i + 1}</div>
        <div class="rv-step-body">
          <textarea class="step-text bv-step-text" data-i="${i}" rows="2" placeholder="写写这一步怎么做…">${escapeHtml(s.text || "")}</textarea>
          ${s.img ? `<img class="rv-step-img" src="${s.img}" alt="步骤图" />` : ""}
          <div class="bv-step-img-row">
            <label class="step-img-btn">📷 ${s.img ? "换图" : "加图"}
              <input type="file" class="bv-img-input" accept="image/*" data-i="${i}" hidden />
            </label>
            ${s.img ? `<button type="button" class="step-img-del bv-img-del" data-i="${i}">✕ 移除图</button>` : ""}
            <button type="button" class="step-img-del bv-step-del" data-i="${i}">🗑 删步骤</button>
          </div>
        </div>
      </div>`).join("") +
      `<button type="button" class="mini-btn" id="bvAddStep">＋ 添加步骤</button>`;

    // 编辑每步文字（不重渲染，避免输入框失焦）
    $$("#bvSteps .bv-step-text").forEach((ta) =>
      ta.addEventListener("input", () => {
        const i = +ta.dataset.i;
        state.bakeNotes[currentBakeName].steps[i].text = ta.value;
        saveAll();
      })
    );
    // 加图
    $$("#bvSteps .bv-img-input").forEach((inp) =>
      inp.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const i = +inp.dataset.i;
        state.bakeNotes[currentBakeName].steps[i].img = await resizeImage(file, 800, 0.7);
        saveAll(); renderBakeVideoSteps();
      })
    );
    // 移除图
    $$("#bvSteps .bv-img-del").forEach((b) =>
      b.addEventListener("click", () => {
        const i = +b.dataset.i;
        state.bakeNotes[currentBakeName].steps[i].img = null;
        saveAll(); renderBakeVideoSteps();
      })
    );
    // 删除步骤
    $$("#bvSteps .bv-step-del").forEach((b) =>
      b.addEventListener("click", () => {
        const i = +b.dataset.i;
        state.bakeNotes[currentBakeName].steps.splice(i, 1);
        saveAll(); renderBakeVideoSteps();
        $("#bvMeta").textContent = "🍽️ 分类：" + currentBakeCatName + " · 共 " + state.bakeNotes[currentBakeName].steps.length + " 步";
      })
    );
    // 添加步骤
    $("#bvAddStep").addEventListener("click", () => {
      state.bakeNotes[currentBakeName].steps.push({ text: "", img: null });
      saveAll(); renderBakeVideoSteps();
      $("#bvMeta").textContent = "🍽️ 分类：" + currentBakeCatName + " · 共 " + state.bakeNotes[currentBakeName].steps.length + " 步";
    });
  }

  $("#bvClose").addEventListener("click", () => bakeVideoModal.classList.remove("show"));
  $("#bvFavBtn").addEventListener("click", () => {
    if (!currentBakeName) return;
    const on = !!(state.favs[currentBakeName] && state.favs[currentBakeName].cols && state.favs[currentBakeName].cols.length);
    if (on) {
      delete state.favs[currentBakeName];
    } else {
      const v = findBakeVideo(currentBakeName);
      state.favs[currentBakeName] = { name: currentBakeName, kw: v ? v.kw : "", emoji: v ? v.emoji : "", cols: ["想做"] };
    }
    saveAll();
    const nowOn = !!(state.favs[currentBakeName] && state.favs[currentBakeName].cols && state.favs[currentBakeName].cols.length);
    $("#bvFavBtn").textContent = nowOn ? "♥ 已收藏" : "♡ 收藏";
    $("#bvFavBtn").classList.toggle("on", nowOn);
    renderBakeVideos();
  });
  $("#bvSaveRecipe").addEventListener("click", () => {
    if (!currentBakeName) return;
    if (state.recipes.some((r) => r.name === currentBakeName)) { alert("「我的食谱」里已经有同名食谱啦～"); return; }
    const v = findBakeVideo(currentBakeName);
    const note = state.bakeNotes[currentBakeName];
    const steps = (note && note.steps && note.steps.length)
      ? note.steps.filter((s) => s.text || s.img).map((s) => ({ text: s.text || "", img: s.img || null }))
      : (v ? (v.steps || []).map((s) => ({ text: s.text || "", img: null })) : []);
    state.recipes.push({ id: uid(), name: currentBakeName, emoji: v ? v.emoji : "🧁", time: 0, ingredients: "", steps, note: "" });
    saveAll(); renderRecipes();
    alert("已存到「我的食谱」🎉 可在下方点开继续编辑食材和步骤～");
  });

  /* ----- 收藏 / 分类 ----- */
  let favSheetName = null;
  const favSheet = $("#favSheet");
  const favModal = $("#favModal");

  function favColsOf(name) {
    return (state.favs[name] && state.favs[name].cols) || [];
  }

  function openFavSheet(name) {
    favSheetName = name;
    const v = findBakeVideo(name);
    $("#favSheetTitle").textContent = `${v ? v.emoji + " " : ""}${name}`;
    renderFavChips();
    favSheet.classList.add("show");
  }

  function findBakeVideo(name) {
    for (const k in BAKE_POOL) {
      const hit = BAKE_POOL[k].find((x) => x.name === name);
      if (hit) return hit;
    }
    return null;
  }

  function renderFavChips() {
    const cur = favColsOf(favSheetName);
    $("#favChips").innerHTML = state.favCols.map((c) =>
      `<span class="fav-chip${cur.includes(c) ? " on" : ""}" data-col="${escapeHtml(c)}">${escapeHtml(c)}</span>`
    ).join("");
    $$("#favChips .fav-chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        const col = chip.dataset.col;
        const fav = state.favs[favSheetName] || (state.favs[favSheetName] = { name: favSheetName, kw: "", emoji: "", cols: [] });
        const v = findBakeVideo(favSheetName);
        if (v) { fav.kw = v.kw; fav.emoji = v.emoji; }
        if (!fav.cols) fav.cols = [];
        const i = fav.cols.indexOf(col);
        if (i >= 0) fav.cols.splice(i, 1); else fav.cols.push(col);
        if (!fav.cols.length) delete state.favs[favSheetName];
        saveAll(); renderFavChips(); renderBakeVideos();
      })
    );
  }

  $("#favNewBtn").addEventListener("click", () => {
    const name = $("#favNewInput").value.trim();
    if (!name) { alert("请输入分类名称"); return; }
    if (!state.favCols.includes(name)) state.favCols.push(name);
    const fav = state.favs[favSheetName] || (state.favs[favSheetName] = { name: favSheetName, kw: "", emoji: "", cols: [] });
    const v = findBakeVideo(favSheetName);
    if (v) { fav.kw = v.kw; fav.emoji = v.emoji; }
    if (!fav.cols) fav.cols = [];
    if (!fav.cols.includes(name)) fav.cols.push(name);
    saveAll();
    $("#favNewInput").value = "";
    renderFavChips(); renderBakeVideos();
  });
  $("#favSheetDone").addEventListener("click", () => favSheet.classList.remove("show"));

  function renderFavModal() {
    const names = Object.keys(state.favs).filter((n) => state.favs[n].cols && state.favs[n].cols.length);
    if (!names.length) {
      $("#favList").innerHTML = `<div class="fav-empty">还没有收藏哦～ 点视频左边的 ♡ 就能收藏 🧁</div>`;
      return;
    }
    let html = "";
    state.favCols.forEach((col) => {
      const items = names.filter((n) => state.favs[n].cols.includes(col));
      if (!items.length) return;
      html += `<div class="fav-group">
        <div class="fav-group-head"><span>📁 ${escapeHtml(col)}</span><span class="fg-count">${items.length} 个</span></div>`;
      items.forEach((n) => {
        const f = state.favs[n];
        html += `<div class="fav-item">
          <div class="fi-emoji">${f.emoji || "🧁"}</div>
          <div class="fi-main">
            <div class="fi-name">${escapeHtml(n)}</div>
            <div class="fi-kw">🔍 ${escapeHtml(f.kw || "")}</div>
          </div>
          <a class="fi-link" href="${bili((f.kw || n) + " 教程")}" target="_blank" rel="noopener">📺</a>
          <button class="fi-del" data-name="${escapeHtml(n)}">✕</button>
        </div>`;
      });
      html += `</div>`;
    });
    if (!html) { $("#favList").innerHTML = `<div class="fav-empty">还没有收藏哦～ 点视频左边的 ♡ 就能收藏 🧁</div>`; return; }
    $("#favList").innerHTML = html;
    $$(".fi-del", $("#favList")).forEach((b) =>
      b.addEventListener("click", () => {
        delete state.favs[b.dataset.name];
        saveAll(); renderFavModal(); renderBakeVideos();
      })
    );
  }

  $("#bakeFavBtn").addEventListener("click", () => { renderFavModal(); favModal.classList.add("show"); });
  $("#favModalClose").addEventListener("click", () => favModal.classList.remove("show"));

  $("#bakeShuffle").addEventListener("click", () => {
    const d = todayStr();
    state.bakeSeeds[d] = (state.bakeSeeds[d] || 0) + 1;
    saveAll(); renderBakeVideos();
  });

  function renderRecipes() {
    if (!state.recipes.length) {
      recipeGrid.innerHTML = ""; $("#recipeEmpty").style.display = "block"; return;
    }
    $("#recipeEmpty").style.display = "none";
    recipeGrid.innerHTML = state.recipes.map((r) =>
      `<div class="recipe-card" data-id="${r.id}">
        <button class="recipe-del" data-id="${r.id}">✕</button>
        <div class="recipe-emoji">${r.emoji || "🧁"}</div>
        <div class="recipe-name">${escapeHtml(r.name)}</div>
        <div class="recipe-time">⏱️ ${r.time ? r.time + " 分钟" : "时间未填"}</div>
      </div>`).join("");
    $$(".recipe-card", recipeGrid).forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.classList.contains("recipe-del")) return;
        const r = state.recipes.find((x) => x.id === card.dataset.id);
        if (r) viewRecipe(r);
      });
    });
    $$(".recipe-del", recipeGrid).forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        state.recipes = state.recipes.filter((x) => x.id !== b.dataset.id);
        saveAll(); renderRecipes();
      })
    );
  }

  function recipeDetail(r) {
    return r;
  }

  /* ----- 食谱详情 + 烘焙计时器 + 购物清单 ----- */
  const recipeViewModal = $("#recipeViewModal");
  const shopModal = $("#shopModal");
  let currentRecipe = null;

  // 把 r.steps（兼容旧版纯文本）统一成 [{text, img}] 数组
  function normalizeSteps(r) {
    const s = r.steps;
    if (Array.isArray(s)) {
      return s.map((x) =>
        typeof x === "string" ? { text: x, img: null } : { text: x.text || "", img: x.img || null }
      ).filter((x) => x.text || x.img);
    }
    if (typeof s === "string") {
      return s.split(/\n+/).map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t, img: null }));
    }
    return [];
  }
  // 从步骤里解析每步时长（如「烤30分钟」「醒发15分」「煮2小时」），接受纯文本或 [{text}] 数组
  function parseSteps(input) {
    let arr = input;
    if (typeof input === "string") {
      arr = input.split(/\n+/).map((s) => ({ text: s.trim() })).filter((x) => x.text);
    }
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => {
      const line = (s && s.text) || "";
      const m = line.match(/(\d+(?:\.\d+)?)\s*(分钟|分|min|小时|h|秒|s)/i);
      let sec = 0;
      if (m) {
        const n = parseFloat(m[1]);
        const u = m[2].toLowerCase();
        if (u === "小时" || u === "h") sec = n * 3600;
        else if (u === "秒" || u === "s") sec = n;
        else sec = n * 60; // 分钟/分/min
      }
      return { text: line, sec };
    });
  }

  function parseIngredients(text) {
    if (!text) return [];
    const out = [];
    text.split(/[\n,，、;；]+/).forEach((s) => {
      s = s.trim().replace(/\s{2,}/g, " ");
      if (s) out.push(s);
    });
    return out;
  }

  function fmtSec(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  // 计时器状态
  let timerSteps = [];
  let timerIdx = 0;
  let timerRemain = 0;
  let timerRunning = false;
  let timerInterval = null;
  let wakeLockObj = null;
  let keepAudio = null;

  function rvBeep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const C = new AC();
      [0, 0.25, 0.5].forEach((d) => {
        const o = C.createOscillator(), g = C.createGain();
        o.frequency.value = 880; o.type = "sine";
        o.connect(g); g.connect(C.destination);
        const t = C.currentTime + d;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
      });
      setTimeout(() => { try { C.close(); } catch (e) {} }, 900);
    } catch (e) {}
  }
  function rvVibrate() { if (navigator.vibrate) try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {} }
  function rvNotify(title, body) {
    try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body }); } catch (e) {}
  }
  // 后台保活：无声音频 + 屏幕唤醒锁，尽量让锁屏也能响
  async function startKeepAlive() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.value = 40; osc.type = "sine"; g.gain.value = 0.0001;
      osc.connect(g); g.connect(ctx.destination); osc.start();
      keepAudio = { ctx, osc };
      if ("wakeLock" in navigator) { try { wakeLockObj = await navigator.wakeLock.request("screen"); } catch (e) {} }
    } catch (e) {}
  }
  function stopKeepAlive() {
    try { if (keepAudio) { keepAudio.osc.stop(); keepAudio.ctx.close(); keepAudio = null; } } catch (e) {}
    try { if (wakeLockObj) { wakeLockObj.release(); wakeLockObj = null; } } catch (e) {}
  }

  function renderTimerSteps() {
    const box = $("#rvTimerSteps");
    if (!timerSteps.length) { box.innerHTML = `<span class="rv-ts-chip">未识别到时长</span>`; return; }
    box.innerHTML = timerSteps.map((s, i) =>
      `<span class="rv-ts-chip" data-i="${i}">${s.sec ? fmtSec(s.sec) : "手动"} · ${escapeHtml(s.text.slice(0, 10))}</span>`
    ).join("");
    $$("#rvTimerSteps .rv-ts-chip").forEach((chip) => {
      const i = +chip.dataset.i;
      chip.classList.toggle("active", i === timerIdx);
      chip.classList.toggle("done", i < timerIdx);
    });
  }
  function updateTimerUI() {
    $("#rvTimerDisplay").textContent = fmtSec(timerRemain);
    if (timerIdx < timerSteps.length) $("#rvTimerStepText").textContent = timerSteps[timerIdx].text.slice(0, 60);
    $("#rvTimerStep").textContent = timerSteps.length ? `步骤 ${Math.min(timerIdx + 1, timerSteps.length)}/${timerSteps.length}` : "";
    renderTimerSteps();
  }
  function rvStart() {
    if (timerRunning) return;
    if (!timerSteps.length) { alert("这个食谱没识别到步骤时长，先去编辑步骤（如写「烤30分钟」）就能计时啦～"); return; }
    if (timerIdx >= timerSteps.length) rvReset();
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
    timerRunning = true;
    $("#rvTimerStart").textContent = "⏸ 暂停";
    startKeepAlive();
    timerInterval = setInterval(rvTick, 1000);
  }
  function rvPause() {
    timerRunning = false;
    $("#rvTimerStart").textContent = "▶ 继续";
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    stopKeepAlive();
  }
  function rvReset() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerRunning = false;
    timerIdx = 0;
    timerRemain = timerSteps.length ? timerSteps[0].sec : 0;
    $("#rvTimerStart").textContent = "▶ 开始";
    $("#rvTimerDisplay").classList.remove("done");
    updateTimerUI();
  }
  function rvNext() {
    if (timerIdx < timerSteps.length - 1) { timerIdx++; timerRemain = timerSteps[timerIdx].sec; updateTimerUI(); }
    else rvFinish();
  }
  function rvTick() {
    timerRemain--;
    if (timerRemain <= 0) {
      timerRemain = 0; updateTimerUI();
      if (timerIdx < timerSteps.length - 1) {
        rvBeep(); rvVibrate(); rvNotify("⏲️ 步骤完成", timerSteps[timerIdx].text.slice(0, 40));
        timerIdx++; timerRemain = timerSteps[timerIdx].sec;
        updateTimerUI();
        if (timerSteps[timerIdx].sec === 0) { rvPause(); $("#rvTimerStepText").textContent = "该步骤没写时长，点「下一步」继续～"; }
      } else {
        rvFinish();
      }
    } else {
      updateTimerUI();
    }
  }
  function rvFinish() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerRunning = false;
    $("#rvTimerStart").textContent = "▶ 开始";
    $("#rvTimerDisplay").classList.add("done");
    $("#rvTimerDisplay").textContent = "完成🎉";
    rvBeep(); rvVibrate();
    rvNotify("🎉 烘焙完成！", "「" + (currentRecipe ? currentRecipe.name : "") + "」做好啦～");
    stopKeepAlive();
  }

  function viewRecipe(r) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    stopKeepAlive();
    currentRecipe = r;
    $("#rvTitle").textContent = (r.emoji || "🧁") + " " + r.name;
    $("#rvMeta").textContent = "⏱️ 耗时：" + (r.time ? r.time + " 分钟" : "—");
    $("#rvIngredients").textContent = r.ingredients || "（未填写）";
    const stepsArr = normalizeSteps(r);
    $("#rvSteps").innerHTML = stepsArr.length ? stepsArr.map((s, i) =>
      `<div class="rv-step">
        <div class="rv-step-num">${i + 1}</div>
        <div class="rv-step-body">
          <div class="rv-step-text">${escapeHtml(s.text || "")}</div>
          ${s.img ? `<img class="rv-step-img" src="${s.img}" alt="步骤图" />` : ""}
        </div>
      </div>`).join("") : "（未填写）";
    if (r.note) { $("#rvNote").textContent = r.note; $("#rvNoteWrap").style.display = "block"; }
    else $("#rvNoteWrap").style.display = "none";
    let parsed = parseSteps(stepsArr);
    if ((!parsed.length || parsed.every((s) => s.sec === 0)) && r.time > 0) {
      parsed = [{ text: "⏱️ 总耗时 " + r.time + " 分钟", sec: r.time * 60 }];
    }
    timerSteps = parsed;
    timerIdx = 0; timerRemain = timerSteps.length ? timerSteps[0].sec : 0;
    timerRunning = false;
    $("#rvTimerStart").textContent = "▶ 开始";
    $("#rvTimerDisplay").classList.remove("done");
    updateTimerUI();
    recipeViewModal.classList.add("show");
  }

  $("#rvClose").addEventListener("click", () => {
    rvPause(); recipeViewModal.classList.remove("show");
  });
  $("#rvTimerStart").addEventListener("click", rvStart);
  $("#rvTimerReset").addEventListener("click", rvReset);
  $("#rvTimerNext").addEventListener("click", rvNext);
  $("#rvToShop").addEventListener("click", () => {
    if (!currentRecipe) return;
    const items = parseIngredients(currentRecipe.ingredients);
    if (!items.length) { alert("这个食谱还没有食材，先去「编辑」填上吧～"); return; }
    const have = new Set(state.shopping.map((x) => x.name.toLowerCase()));
    let added = 0;
    items.forEach((name) => {
      if (have.has(name.toLowerCase())) return;
      state.shopping.push({ id: uid(), name, done: false });
      have.add(name.toLowerCase()); added++;
    });
    saveAll(); renderShop(); shopModal.classList.add("show");
    if (added === 0) alert("食材都已在清单里啦 🧺");
  });
  $("#rvEdit").addEventListener("click", () => {
    const r = currentRecipe; if (!r) return;
    recipeViewModal.classList.remove("show");
    state.editingRecipeId = r.id;
    $("#recipeModalTitle").textContent = "✏️ 编辑食谱";
    $("#rNameInput").value = r.name; $("#rEmojiInput").value = r.emoji || "🧁";
    $("#rTimeInput").value = r.time || ""; $("#rIngInput").value = r.ingredients || "";
    editSteps = normalizeSteps(r); renderStepEditor();
    $("#rNoteInput").value = r.note || "";
    recipeModal.classList.add("show");
  });

  /* ----- 购物清单 ----- */
  function renderShop() {
    const list = $("#shopList");
    if (!state.shopping.length) {
      list.innerHTML = ""; $("#shopEmpty").style.display = "block"; $("#shopCount").textContent = ""; return;
    }
    $("#shopEmpty").style.display = "none";
    const done = state.shopping.filter((x) => x.done).length;
    $("#shopCount").textContent = done + "/" + state.shopping.length;
    list.innerHTML = state.shopping.map((x) =>
      `<div class="shop-item${x.done ? " done" : ""}" data-id="${x.id}">
        <button class="si-check" data-id="${x.id}">${x.done ? "✓" : ""}</button>
        <span class="si-name">${escapeHtml(x.name)}</span>
        <button class="si-del" data-id="${x.id}">✕</button>
      </div>`).join("");
    $$(".si-check", list).forEach((b) =>
      b.addEventListener("click", () => {
        const it = state.shopping.find((s) => s.id === b.dataset.id);
        if (it) { it.done = !it.done; saveAll(); renderShop(); }
      })
    );
    $$(".si-del", list).forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        state.shopping = state.shopping.filter((s) => s.id !== b.dataset.id);
        saveAll(); renderShop();
      })
    );
  }
  $("#shopBtn").addEventListener("click", () => { renderShop(); shopModal.classList.add("show"); });
  $("#shopClose").addEventListener("click", () => shopModal.classList.remove("show"));
  $("#shopClear").addEventListener("click", () => {
    if (!state.shopping.length) return;
    if (!confirm("确定清空整个购物清单？")) return;
    state.shopping = []; saveAll(); renderShop();
  });

  /* ----- 食谱步骤编辑（图文） ----- */
  let editSteps = [];
  function renderStepEditor() {
    const box = $("#stepEditor");
    if (!editSteps.length) {
      box.innerHTML = `<div class="step-empty">还没有步骤，点下面「＋ 添加步骤」开始写～</div>`;
      return;
    }
    box.innerHTML = editSteps.map((s, i) =>
      `<div class="step-row" data-i="${i}">
        <div class="step-num">${i + 1}</div>
        <div class="step-body">
          <textarea class="step-text" rows="2" placeholder="如：烤箱预热180度，烤30分钟">${escapeHtml(s.text || "")}</textarea>
          <div class="step-img-row">
            <label class="step-img-btn">📷 图片
              <input type="file" class="step-img-input" accept="image/*" hidden />
            </label>
            ${s.img ? `<img class="step-img-prev" src="${s.img}" alt="步骤图" />` : ""}
            ${s.img ? `<button type="button" class="step-img-del">✕ 移除图</button>` : ""}
          </div>
        </div>
        <button type="button" class="step-del">✕</button>
      </div>`).join("");
    $$("#stepEditor .step-text").forEach((ta, i) =>
      ta.addEventListener("input", () => { editSteps[i].text = ta.value; })
    );
    $$("#stepEditor .step-img-input").forEach((inp, i) =>
      inp.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        editSteps[i].img = await resizeImage(file, 800, 0.7);
        renderStepEditor();
      })
    );
    $$("#stepEditor .step-img-del").forEach((b) =>
      b.addEventListener("click", () => {
        const i = +b.closest(".step-row").dataset.i;
        editSteps[i].img = null;
        renderStepEditor();
      })
    );
    $$("#stepEditor .step-del").forEach((b) =>
      b.addEventListener("click", () => {
        const i = +b.closest(".step-row").dataset.i;
        editSteps.splice(i, 1);
        renderStepEditor();
      })
    );
  }
  $("#addStepBtn").addEventListener("click", () => {
    editSteps.push({ text: "", img: null });
    renderStepEditor();
  });

  const recipeModal = $("#recipeModal");
  $("#addRecipeBtn").addEventListener("click", () => {
    state.editingRecipeId = null;
    $("#recipeModalTitle").textContent = "🍰 新食谱";
    $("#rNameInput").value = ""; $("#rEmojiInput").value = "🧁";
    $("#rTimeInput").value = ""; $("#rIngInput").value = "";
    editSteps = []; renderStepEditor();
    $("#rNoteInput").value = "";
    recipeModal.classList.add("show");
  });
  $("#recipeCancel").addEventListener("click", () => recipeModal.classList.remove("show"));
  $("#recipeSave").addEventListener("click", () => {
    const name = $("#rNameInput").value.trim();
    if (!name) { alert("请输入食谱名称"); return; }
    const data = {
      name,
      emoji: $("#rEmojiInput").value.trim() || "🧁",
      time: parseInt($("#rTimeInput").value, 10) || 0,
      ingredients: $("#rIngInput").value.trim(),
      steps: editSteps.filter((s) => s.text || s.img).map((s) => ({ text: s.text.trim(), img: s.img || null })),
      note: $("#rNoteInput").value.trim(),
    };
    if (state.editingRecipeId) {
      const r = state.recipes.find((x) => x.id === state.editingRecipeId);
      Object.assign(r, data);
    } else {
      state.recipes.push({ id: uid(), ...data });
    }
    saveAll(); recipeModal.classList.remove("show"); renderRecipes();
  });

  /* =========================================================
     血压健康模块
     ========================================================= */
  const BP_TAGS = ["空腹", "饭后", "晨起", "睡前", "运动后", "服药后", "随机测量"];
  const BP_LEVELS = {
    normal:   { label: "正常血压",          bg: "#d8f5ec", fg: "#1f8a6a", border: "#7ec8a0" },
    elevated: { label: "正常高值",          bg: "#fff1cf", fg: "#a86500", border: "#f5a623" },
    lv1:      { label: "1级高血压（轻度）",  bg: "#ffe3c2", fg: "#b84700", border: "#f08a24" },
    lv2:      { label: "2级高血压（中度）",  bg: "#ffd0b0", fg: "#a83c08", border: "#e8590c" },
    lv3:      { label: "3级高血压（重度）",  bg: "#ffc2d2", fg: "#b01257", border: "#e23757" },
    ish:      { label: "单纯收缩期高血压",    bg: "#e6dcff", fg: "#5f37a8", border: "#9b59b6" },
  };

  function bpNorm() {
    if (!state.bp || typeof state.bp !== "object") state.bp = {};
    if (!Array.isArray(state.bp.records)) state.bp.records = [];
    if (!state.bp.reminder || typeof state.bp.reminder !== "object")
      state.bp.reminder = { morning: { on: false, time: "08:00" }, night: { on: false, time: "21:00" } };
    if (!state.bp.reminder.morning) state.bp.reminder.morning = { on: false, time: "08:00" };
    if (!state.bp.reminder.night) state.bp.reminder.night = { on: false, time: "21:00" };
    if (typeof state.bp.filter !== "string") state.bp.filter = "all";
    state.bp.search = state.bp.search || "";
    state.bp.from = state.bp.from || "";
    state.bp.to = state.bp.to || "";
    if (typeof state.bp._editingId === "undefined") state.bp._editingId = null;
    if (typeof state.bp._batch === "undefined") state.bp._batch = false;
    if (!Array.isArray(state.bp._sel)) state.bp._sel = [];
  }

  function bpLevel(sbp, dbp) {
    // 单纯收缩期高血压：收缩压≥140 且 舒张压<90
    if (sbp >= 140 && dbp < 90) return "ish";
    const sLvl = sbp >= 180 ? 5 : sbp >= 160 ? 4 : sbp >= 140 ? 3 : sbp >= 120 ? 2 : 1;
    const dLvl = dbp >= 110 ? 5 : dbp >= 100 ? 4 : dbp >= 90 ? 3 : dbp >= 80 ? 2 : 1;
    const max = Math.max(sLvl, dLvl); // 收缩压/舒张压分属不同级别时，以较高级别为准
    return ({ 1: "normal", 2: "elevated", 3: "lv1", 4: "lv2", 5: "lv3" })[max];
  }

  function bpFiltered() {
    bpNorm();
    let recs = state.bp.records.slice();
    const f = state.bp.filter;
    const today = todayStr();
    if (f === "day") recs = recs.filter((r) => (r.dt || "").slice(0, 10) === today);
    else if (f === "week") {
      const cut = new Date(Date.now() - 6 * 864e5);
      recs = recs.filter((r) => new Date(r.dt) >= cut);
    } else if (f === "month") {
      const ym = today.slice(0, 7);
      recs = recs.filter((r) => (r.dt || "").slice(0, 7) === ym);
    }
    const kw = (state.bp.search || "").trim().toLowerCase();
    if (kw) recs = recs.filter((r) =>
      (r.note || "").toLowerCase().includes(kw) ||
      (r.slot || "").toLowerCase().includes(kw) ||
      (r.tags || []).join(" ").toLowerCase().includes(kw)
    );
    const from = state.bp.from, to = state.bp.to;
    if (from) recs = recs.filter((r) => (r.dt || "").slice(0, 10) >= from);
    if (to) recs = recs.filter((r) => (r.dt || "").slice(0, 10) <= to);
    recs.sort((a, b) => (a.dt < b.dt ? 1 : a.dt > b.dt ? -1 : 0));
    return recs;
  }

  function bpStats(recs) {
    if (!recs.length) return null;
    const sbp = recs.map((r) => r.sbp), dbp = recs.map((r) => r.dbp);
    const hr = recs.map((r) => r.hr).filter((x) => typeof x === "number" && !isNaN(x));
    const avg = (a) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
    return {
      count: recs.length,
      sbpMax: Math.max.apply(null, sbp), sbpMin: Math.min.apply(null, sbp), sbpAvg: avg(sbp),
      dbpMax: Math.max.apply(null, dbp), dbpMin: Math.min.apply(null, dbp), dbpAvg: avg(dbp),
      hrAvg: hr.length ? avg(hr) : null,
    };
  }

  function drawBpChart(recs) {
    if (recs.length < 2) return "";
    const W = 320, H = 200, padL = 34, padR = 12, padT = 16, padB = 26;
    const all = recs.map((r) => r.sbp).concat(recs.map((r) => r.dbp));
    let min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    if (min === max) { min -= 6; max += 6; }
    const span = max - min; min -= span * 0.15; max += span * 0.15;
    const n = recs.length;
    const x = (i) => padL + (i * (W - padL - padR)) / (n - 1);
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    let svg = "";
    for (let g = 0; g <= 3; g++) {
      const gy = padT + (g * (H - padT - padB)) / 3;
      const val = max - (g * (max - min)) / 3;
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#ffe1ec" stroke-width="1"/>';
      svg += '<text x="' + (padL - 3) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10" fill="#a08a98">' + Math.round(val) + '</text>';
    }
    const line = (key, color) => {
      let s = '<polyline points="';
      s += recs.map((r, i) => x(i) + "," + y(r[key])).join(" ");
      s += '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      recs.forEach((r, i) => { s += '<circle cx="' + x(i) + '" cy="' + y(r[key]) + '" r="3" fill="#fff" stroke="' + color + '" stroke-width="2"/>'; });
      return s;
    };
    svg += line("dbp", "#54a0ff");
    svg += line("sbp", "#ff6f91");
    const step = Math.ceil(n / 5);
    recs.forEach((r, i) => {
      if (i % step === 0 || i === n - 1)
        svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="#a08a98">' + (r.dt || "").slice(5, 10) + '</text>';
    });
    svg += '<rect x="' + padL + '" y="' + (H - 1) + '" width="10" height="3" fill="#ff6f91"/><text x="' + (padL + 14) + '" y="' + (H + 1) + '" font-size="9" fill="#a08a98">高压</text>';
    svg += '<rect x="' + (padL + 52) + '" y="' + (H - 1) + '" width="10" height="3" fill="#54a0ff"/><text x="' + (padL + 66) + '" y="' + (H + 1) + '" font-size="9" fill="#a08a98">低压</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet">' + svg + '</svg>';
  }

  function drawBpMonthChart(allRecs) {
    bpNorm();
    const map = {};
    allRecs.forEach((r) => {
      const ym = (r.dt || "").slice(0, 7);
      if (!ym || ym.length < 7) return;
      if (!map[ym]) map[ym] = { sbp: [], dbp: [], hr: [] };
      map[ym].sbp.push(r.sbp);
      map[ym].dbp.push(r.dbp);
      if (typeof r.hr === "number" && !isNaN(r.hr)) map[ym].hr.push(r.hr);
    });
    const months = Object.keys(map).sort();
    if (!months.length) return "";
    const data = months.map((ym) => {
      const m = map[ym];
      const avg = (a) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
      return { ym: ym, sbp: avg(m.sbp), dbp: avg(m.dbp), hr: m.hr.length ? avg(m.hr) : null };
    });
    const show = data.slice(-12);
    const n = show.length;
    if (!n) return "";
    const W = 320, H = 200, padL = 34, padR = 12, padT = 16, padB = 30;
    const all = show.map((d) => d.sbp).concat(show.map((d) => d.dbp));
    let min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    if (min === max) { min -= 6; max += 6; }
    const span = max - min; min -= span * 0.15; max += span * 0.15;
    const x = (i) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    let svg = "";
    for (let g = 0; g <= 3; g++) {
      const gy = padT + (g * (H - padT - padB)) / 3;
      const val = max - (g * (max - min)) / 3;
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#ffe1ec" stroke-width="1"/>';
      svg += '<text x="' + (padL - 3) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10" fill="#a08a98">' + Math.round(val) + '</text>';
    }
    const line = (key, color) => {
      let s = '<polyline points="';
      s += show.map((d, i) => x(i) + "," + y(d[key])).join(" ");
      s += '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      show.forEach((d, i) => { s += '<circle cx="' + x(i) + '" cy="' + y(d[key]) + '" r="3" fill="#fff" stroke="' + color + '" stroke-width="2"/>'; });
      return s;
    };
    svg += line("dbp", "#54a0ff");
    svg += line("sbp", "#ff6f91");
    const step = Math.max(1, Math.ceil(n / 6));
    show.forEach((d, i) => {
      if (i % step === 0 || i === n - 1)
        svg += '<text x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="9" fill="#a08a98">' + d.ym.slice(2) + '</text>';
    });
    svg += '<rect x="' + padL + '" y="' + (H - 1) + '" width="10" height="3" fill="#ff6f91"/><text x="' + (padL + 14) + '" y="' + (H + 1) + '" font-size="9" fill="#a08a98">高压</text>';
    svg += '<rect x="' + (padL + 52) + '" y="' + (H - 1) + '" width="10" height="3" fill="#54a0ff"/><text x="' + (padL + 66) + '" y="' + (H + 1) + '" font-size="9" fill="#a08a98">低压</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet">' + svg + '</svg>';
  }

  let bpRemTimers = [];
  function scheduleBpReminders() {
    bpRemTimers.forEach((t) => clearTimeout(t));
    bpRemTimers = [];
    bpNorm();
    const rm = state.bp.reminder;
    [["morning", rm.morning], ["night", rm.night]].forEach(([k, cfg]) => {
      if (!cfg || !cfg.on) return;
      const parts = (cfg.time || "08:00").split(":");
      const hh = parseInt(parts[0], 10) || 0, mm = parseInt(parts[1], 10) || 0;
      const now = new Date();
      const next = new Date(now); next.setHours(hh, mm, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const ms = next - now;
      const timer = setTimeout(() => {
        bpToast(k === "morning" ? "🌅 晨起测量提醒" : "🌙 睡前测量提醒", "该测血压啦～记得记录一条 🩺");
        scheduleBpReminders();
      }, ms);
      bpRemTimers.push(timer);
    });
  }

  function bpToast(title, msg) {
    let t = document.getElementById("bpToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "bpToast";
      t.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;background:#fff;color:var(--ink);border:2px solid #ffc2dd;border-radius:16px;padding:12px 16px;box-shadow:0 6px 20px rgba(255,150,190,.35);max-width:88%;font-family:var(--font);display:none;";
      document.body.appendChild(t);
    }
    t.innerHTML = '<div style="font-weight:800;color:var(--pink-deep)">' + escapeHtml(title) + '</div><div style="font-size:13px;margin-top:4px">' + escapeHtml(msg) + '</div>';
    t.style.display = "block";
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.style.display = "none"; }, 8000);
  }

  function renderBp() {
    bpNorm();
    const recs = bpFiltered();
    const list = $("#bpList");
    const empty = $("#bpEmpty");

    $("#bpChips").innerHTML = [["all", "全部"], ["day", "今日"], ["week", "近7天"], ["month", "本月"]].map((p) =>
      '<button class="bp-chip' + (state.bp.filter === p[0] ? " on" : "") + '" data-f="' + p[0] + '">' + p[1] + '</button>'
    ).join("");

    const st = bpStats(recs);
    $("#bpStats").innerHTML = st
      ? '<div class="bp-stat"><span>记录数</span><b>' + st.count + '</b></div>'
        + '<div class="bp-stat"><span>高压</span><b>' + st.sbpMin + '~' + st.sbpMax + ' <i>(均' + st.sbpAvg + ')</i></b></div>'
        + '<div class="bp-stat"><span>低压</span><b>' + st.dbpMin + '~' + st.dbpMax + ' <i>(均' + st.dbpAvg + ')</i></b></div>'
        + '<div class="bp-stat"><span>平均心率</span><b>' + (st.hrAvg != null ? st.hrAvg : "—") + '</b></div>'
      : '<div class="bp-stat"><span>暂无数据</span><b>—</b></div>';

    $("#bpChart").innerHTML = recs.length >= 2 ? drawBpChart(recs) : "";
    const bpMonthEl = $("#bpMonthChart");
    if (bpMonthEl) bpMonthEl.innerHTML = drawBpMonthChart(state.bp.records.slice());

    if (!recs.length) { list.innerHTML = ""; empty.style.display = "block"; }
    else {
      empty.style.display = "none";
      list.innerHTML = recs.map((r) => {
        const lv = bpLevel(r.sbp, r.dbp);
        const L = BP_LEVELS[lv];
        const sel = state.bp._sel.indexOf(r.id) >= 0;
        let html = '<div class="bp-item" style="border-left-color:' + L.border + '">';
        html += '<label class="bp-check" style="display:' + (state.bp._batch ? "flex" : "none") + '"><input type="checkbox" class="bp-sel" data-id="' + r.id + '"' + (sel ? " checked" : "") + '/></label>';
        html += '<div class="bp-main">';
        html += '<div class="bp-line1"><span class="bp-dt">' + escapeHtml((r.dt || "").replace("T", " ")) + '</span>';
        html += '<span class="bp-slot">' + escapeHtml(r.slot || "") + '</span>';
        html += '<span class="bp-badge" style="background:' + L.bg + ';color:' + L.fg + '">' + L.label + '</span></div>';
        html += '<div class="bp-line2"><b class="bp-sbp">' + r.sbp + '</b>/<b class="bp-dbp">' + r.dbp + '</b> mmHg';
        if (typeof r.hr === "number" && !isNaN(r.hr)) html += ' · ❤️ ' + r.hr;
        html += '</div>';
        if (r.tags && r.tags.length) html += '<div class="bp-tags-inline">' + r.tags.map((t) => '<span class="bp-tag">' + escapeHtml(t) + '</span>').join("") + '</div>';
        if (r.note) html += '<div class="bp-note">' + escapeHtml(r.note) + '</div>';
        html += '</div>';
        html += '<div class="bp-ops"><button class="bp-edit" data-id="' + r.id + '">✏️</button><button class="bp-del" data-id="' + r.id + '">🗑️</button></div>';
        html += '</div>';
        return html;
      }).join("");
    }

    const rm = state.bp.reminder;
    $("#bpRmMorningOn").checked = !!rm.morning.on;
    $("#bpRmMorning").value = rm.morning.time;
    $("#bpRmNightOn").checked = !!rm.night.on;
    $("#bpRmNight").value = rm.night.time;
    $("#bpBatchBtn").textContent = state.bp._batch ? "✅ 确认删除选中" : "🗑️ 批量删除";

    $$("#bpChips .bp-chip").forEach((c) => c.addEventListener("click", () => { state.bp.filter = c.dataset.f; saveAll(); renderBp(); }));
    const search = $("#bpSearch"); if (search) { search.value = state.bp.search || ""; search.oninput = () => { state.bp.search = search.value; saveAll(); renderBp(); }; }
    const from = $("#bpFrom"); if (from) { from.value = state.bp.from || ""; from.onchange = () => { state.bp.from = from.value; saveAll(); renderBp(); }; }
    const to = $("#bpTo"); if (to) { to.value = state.bp.to || ""; to.onchange = () => { state.bp.to = to.value; saveAll(); renderBp(); }; }
    $$(".bp-edit", list).forEach((b) => b.addEventListener("click", () => openBpModal(b.dataset.id)));
    $$(".bp-del", list).forEach((b) => b.addEventListener("click", () => {
      if (confirm("删除这条血压记录？")) { state.bp.records = state.bp.records.filter((x) => x.id !== b.dataset.id); saveAll(); renderBp(); }
    }));
    $$(".bp-sel", list).forEach((c) => c.addEventListener("change", () => {
      state.bp._sel = state.bp._sel || [];
      if (c.checked) state.bp._sel.push(c.dataset.id);
      else state.bp._sel = state.bp._sel.filter((id) => id !== c.dataset.id);
    }));
    $("#bpRmMorningOn").onchange = (e) => { state.bp.reminder.morning.on = e.target.checked; saveAll(); scheduleBpReminders(); };
    $("#bpRmMorning").onchange = (e) => { state.bp.reminder.morning.time = e.target.value; saveAll(); scheduleBpReminders(); };
    $("#bpRmNightOn").onchange = (e) => { state.bp.reminder.night.on = e.target.checked; saveAll(); scheduleBpReminders(); };
    $("#bpRmNight").onchange = (e) => { state.bp.reminder.night.time = e.target.value; saveAll(); scheduleBpReminders(); };
  }

  function openBpModal(id) {
    bpNorm();
    state.bp._editingId = id || null;
    const r = id ? state.bp.records.find((x) => x.id === id) : null;
    $("#bpModalTitle").textContent = id ? "✏️ 编辑血压" : "🩺 记血压";
    const now = new Date();
    const defDt = (r && r.dt) ? r.dt : todayStr() + "T" + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    $("#bpMDate").value = (defDt || "").slice(0, 10);
    $("#bpMTime").value = (defDt || "").slice(11, 16) || "08:00";
    $("#bpMSlot").value = (r && r.slot) || "晨起";
    $("#bpMSbp").value = r ? r.sbp : "";
    $("#bpMDbp").value = r ? r.dbp : "";
    $("#bpMHR").value = (r && typeof r.hr === "number") ? r.hr : "";
    $("#bpMNote").value = (r && r.note) || "";
    $("#bpMTags").innerHTML = BP_TAGS.map((t) => {
      const on = (r && r.tags && r.tags.indexOf(t) >= 0);
      return '<button type="button" class="bp-tag-pick' + (on ? " on" : "") + '" data-t="' + t + '">' + t + '</button>';
    }).join("");
    $$("#bpMTags .bp-tag-pick").forEach((b) => b.addEventListener("click", () => b.classList.toggle("on")));
    $("#bpModal").classList.add("show");
  }

  // 持久按钮只绑一次
  $("#bpAddBtn").addEventListener("click", () => openBpModal(null));
  $("#bpMCancel").addEventListener("click", () => { $("#bpModal").classList.remove("show"); state.bp._editingId = null; });
  $("#bpMSave").addEventListener("click", () => {
    bpNorm();
    const sbp = parseInt($("#bpMSbp").value, 10);
    const dbp = parseInt($("#bpMDbp").value, 10);
    if (!(sbp > 0) || !(dbp > 0)) { alert("请填写收缩压和舒张压～"); return; }
    const dt = ($("#bpMDate").value || todayStr()) + "T" + ($("#bpMTime").value || "08:00");
    const tags = $$("#bpMTags .bp-tag-pick.on").map((b) => b.dataset.t);
    const hrRaw = $("#bpMHR").value;
    const hr = hrRaw === "" ? null : (parseInt(hrRaw, 10) || null);
    const data = { dt, slot: $("#bpMSlot").value, sbp, dbp, hr, tags, note: $("#bpMNote").value.trim() };
    if (state.bp._editingId) {
      const r = state.bp.records.find((x) => x.id === state.bp._editingId);
      if (r) Object.assign(r, data);
    } else {
      state.bp.records.push({ id: uid(), ...data });
    }
    saveAll(); $("#bpModal").classList.remove("show"); state.bp._editingId = null; renderBp();
  });
  $("#bpBatchBtn").addEventListener("click", () => {
    bpNorm();
    if (!state.bp._batch) { state.bp._batch = true; state.bp._sel = []; renderBp(); return; }
    const sel = state.bp._sel || [];
    if (!sel.length) { state.bp._batch = false; renderBp(); return; }
    if (confirm("确定删除选中的 " + sel.length + " 条记录？")) {
      state.bp.records = state.bp.records.filter((x) => sel.indexOf(x.id) < 0);
      saveAll();
    }
    state.bp._batch = false; state.bp._sel = []; renderBp();
  });

  /* =========================================================
     日常手账本模块（日系手绘风）
     ========================================================= */
  const DAILY_MOODS = [
    { key: "happy", label: "😊 开心", color: "#ffd6e7" },
    { key: "calm", label: "🌿 平静", color: "#d6f0e0" },
    { key: "tired", label: "😴 疲惫", color: "#ece3d6" },
    { key: "energ", label: "💪 充实", color: "#d6e7ff" },
    { key: "sad", label: "🌧️ 低落", color: "#e3e7f0" },
    { key: "memo", label: "✨ 纪念", color: "#ffe9c2" },
  ];
  const STICKER_CAT = '<svg viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="104" rx="40" ry="9" fill="#fff0f6"/><path d="M36,94 C30,72 34,48 52,40 C64,34 78,38 86,50 C92,62 92,80 88,94 C84,102 76,104 60,104 C44,104 38,100 36,94 Z" fill="#fff" stroke="#8a7f9a" stroke-width="3"/><path d="M48,40 C50,46 46,52 42,54 M72,40 C70,46 74,52 78,54" fill="none" stroke="#8a7f9a" stroke-width="2.5" stroke-linecap="round"/><path d="M34,46 C28,24 44,34 48,42 Z" fill="#fff" stroke="#8a7f9a" stroke-width="3" stroke-linejoin="round"/><path d="M86,46 C92,24 76,34 72,42 Z" fill="#fff" stroke="#8a7f9a" stroke-width="3" stroke-linejoin="round"/><path d="M36,44 C34,32 42,38 44,42 Z M84,44 C86,32 78,38 76,42 Z" fill="#ffd9ea"/><circle cx="46" cy="64" r="7" fill="#8a7f9a"/><circle cx="48" cy="62" r="2.8" fill="#fff"/><circle cx="74" cy="64" r="7" fill="#8a7f9a"/><circle cx="76" cy="62" r="2.8" fill="#fff"/><ellipse cx="38" cy="72" rx="5" ry="3.2" fill="#ffc2dd"/><ellipse cx="82" cy="72" rx="5" ry="3.2" fill="#ffc2dd"/><path d="M57,70 L63,70 L60,74 Z" fill="#ff9ec4"/><path d="M60,74 C56,80 52,76 52,74 M60,74 C64,80 68,76 68,74" fill="none" stroke="#8a7f9a" stroke-width="2" stroke-linecap="round"/><ellipse cx="48" cy="96" rx="6" ry="4" fill="#fff" stroke="#8a7f9a" stroke-width="2.5"/><ellipse cx="72" cy="96" rx="6" ry="4" fill="#fff" stroke="#8a7f9a" stroke-width="2.5"/></svg>';
  const STICKER_RABBIT = '<svg viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="104" rx="40" ry="9" fill="#f3e8ff"/><path d="M48,40 Q40,4 52,8 Q60,16 56,42" fill="#fff" stroke="#9a8fb0" stroke-width="3" stroke-linejoin="round"/><path d="M72,40 Q80,4 68,8 Q60,16 64,42" fill="#fff" stroke="#9a8fb0" stroke-width="3" stroke-linejoin="round"/><path d="M50,40 Q46,16 53,12 M70,40 Q74,16 67,12" fill="#ffd9ea"/><path d="M36,92 C32,70 38,52 56,48 C74,44 88,56 88,76 C88,90 80,98 60,98 C44,98 38,96 36,92 Z" fill="#fff" stroke="#9a8fb0" stroke-width="3"/><circle cx="50" cy="68" r="6.5" fill="#9a8fb0"/><circle cx="52" cy="66" r="2.4" fill="#fff"/><circle cx="72" cy="68" r="6.5" fill="#9a8fb0"/><circle cx="74" cy="66" r="2.4" fill="#fff"/><ellipse cx="42" cy="76" rx="5" ry="3" fill="#ffc2dd"/><ellipse cx="80" cy="76" rx="5" ry="3" fill="#ffc2dd"/><path d="M57,74 L63,74 L60,78 Z" fill="#ff9ec4"/><path d="M60,78 C56,84 52,80 52,77 M60,78 C64,84 68,80 68,77" fill="none" stroke="#9a8fb0" stroke-width="2" stroke-linecap="round"/><ellipse cx="50" cy="92" rx="6" ry="4" fill="#fff" stroke="#9a8fb0" stroke-width="2.5"/><ellipse cx="72" cy="92" rx="6" ry="4" fill="#fff" stroke="#9a8fb0" stroke-width="2.5"/></svg>';
  function stickerSvg(kind) {
    if (kind === "cat") return '<img class="sticker-img" src="sticker-cat.png" alt="小猫" />';
    if (kind === "rabbit") return '<img class="sticker-img" src="sticker-rabbit.png" alt="小兔" />';
    return "";
  }

  let dailyScreen = "cover";
  let monthbookYm = monthStr();
  let readerYm = monthStr();
  let readerIdx = 0;
  let editorId = null;
  let editorPendingImages = [];
  let editorSticker = "";

  function dailyNorm() {
    if (!state.daily || typeof state.daily !== "object") state.daily = {};
    if (!Array.isArray(state.daily.entries)) state.daily.entries = [];
  }
  function dailyEntriesOfMonth(ym) {
    dailyNorm();
    return state.daily.entries.filter((e) => (e.date || "").slice(0, 7) === ym)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time < b.time ? -1 : 1)));
  }
  function getDailyEntry(id) { dailyNorm(); return state.daily.entries.find((e) => e.id === id) || null; }
  function defaultNewDate(ym) {
    const t = todayStr();
    return t.slice(0, 7) === ym ? t : ym + "-01";
  }

  function showDailyScreen(name) {
    dailyScreen = name;
    ["cover", "monthbook", "reader", "editor", "overview"].forEach((s) => {
      const el = $("#daily" + s.charAt(0).toUpperCase() + s.slice(1));
      if (el) el.classList.toggle("active", s === name);
    });
    const fab = $("#dailyAddBtn");
    if (fab) fab.classList.toggle("hidden", !(name === "cover" || name === "monthbook" || name === "reader"));
    if (name === "cover") renderCover();
    else if (name === "monthbook") renderMonthBook();
    else if (name === "reader") renderReader();
    else if (name === "overview") renderOverview();
  }

  function renderCover() {
    const ym = monthStr();
    const cm = $("#coverMonth");
    if (cm && !cm.value) cm.value = ym;
    monthbookYm = cm && cm.value ? cm.value : ym;
    buildCoverCalendar(monthbookYm);
  }
  function buildCoverCalendar(ym) {
    dailyNorm();
    const cal = $("#coverCalendar");
    if (!cal) return;
    const parts = ym.split("-");
    const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
    const first = new Date(y, m - 1, 1);
    const startDow = first.getDay();
    const days = new Date(y, m, 0).getDate();
    const wd = ["日", "一", "二", "三", "四", "五", "六"];
    let head = wd.map((w) => "<span>" + w + "</span>").join("");
    let cells = "";
    for (let i = 0; i < startDow; i++) cells += "<b></b>";
    const today = todayStr();
    for (let d = 1; d <= days; d++) {
      const ds = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      const cls = ds === today ? "today" : "has";
      const has = state.daily.entries.some((e) => (e.date || "").slice(0, 7) === ym);
      cells += '<b class="' + (ds === today ? "today" : (has ? "has" : "")) + '">' + d + "</b>";
    }
    cal.innerHTML = '<div class="cover-cal-head">' + y + '年' + m + '月</div><div class="cover-cal-grid">' + head + cells + '</div>';
  }

  function renderMonthBook() {
    const ym = monthbookYm;
    const [y, m] = ym.split("-").map(Number);
    const title = $("#monthbookTitle");
    if (title) title.textContent = y + "年" + m + "月";
    const no = $("#monthbookNo");
    if (no) no.textContent = "month / " + String(m).padStart(2, "0");
    const entries = dailyEntriesOfMonth(ym);
    const left = $("#monthbookGridLeft");
    const right = $("#monthbookGridRight");
    const empty = $("#monthbookEmpty");
    const desk = $("#monthbookDesk");
    const bottom = $("#monthbookBottom");
    if (!entries.length) {
      if (left) left.innerHTML = "";
      if (right) right.innerHTML = "";
      if (empty) empty.style.display = "block";
      if (desk) desk.style.display = "none";
      if (bottom) bottom.style.display = "none";
      return;
    }
    if (empty) empty.style.display = "none";
    if (desk) desk.style.display = "flex";
    if (bottom) bottom.style.display = "flex";

    const today = todayStr();
    const firstDay = new Date(y, m - 1, 1);
    const startWeek = firstDay.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDate = {};
    entries.forEach((e) => { byDate[e.date] = e; });

    function buildCell(idx) {
      const dayNum = idx - startWeek + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        return '<div class="monthbook-cell monthbook-cell-empty"></div>';
      }
      const dateStr = y + "-" + String(m).padStart(2, "0") + "-" + String(dayNum).padStart(2, "0");
      const isToday = dateStr === today;
      const e = byDate[dateStr];
      const has = !!e;
      let content = '<span class="monthbook-cell-day' + (isToday ? " today" : "") + '">' + dayNum + '</span>';
      if (e) {
        const text = (e.text || "").replace(/\s+/g, " ").trim();
        const snippet = text.length > 10 ? text.slice(0, 10) + "…" : text;
        const img = (e.images && e.images[0]) ? '<img src="' + e.images[0] + '" class="monthbook-cell-img" alt="" />' : "";
        const sticker = e.sticker ? '<span class="monthbook-cell-sticker">' + stickerSvg(e.sticker) + '</span>' : "";
        content += '<div class="monthbook-cell-body">' +
          (snippet ? '<span class="monthbook-cell-text">' + escapeHtml(snippet) + '</span>' : "") +
          img + sticker + '</div>';
      }
      return '<div class="monthbook-cell' + (has ? " has" : "") + (isToday ? " today" : "") + '" data-date="' + dateStr + '" data-has="' + has + '">' + content + '</div>';
    }

    if (left) left.innerHTML = Array.from({length: 21}, (_, i) => buildCell(i)).join("");
    if (right) right.innerHTML = Array.from({length: 21}, (_, i) => buildCell(i + 21)).join("");

    [left, right].forEach((grid) => {
      if (!grid) return;
      $$(".monthbook-cell", grid).forEach((cell) => {
        cell.addEventListener("click", () => {
          const date = cell.dataset.date;
          const has = cell.dataset.has === "true";
          if (has && byDate[date]) {
            const list = dailyEntriesOfMonth(monthbookYm);
            readerIdx = list.findIndex((e) => e.date === date);
            if (readerIdx < 0) readerIdx = 0;
            readerYm = monthbookYm;
            showDailyScreen("reader");
          } else {
            openEditor(date);
            showDailyScreen("editor");
          }
        });
      });
    });
  }

  function renderReader() {
    const ym = readerYm;
    const rm = $("#readerMonth");
    if (rm && rm.value !== ym) rm.value = ym;
    const entries = dailyEntriesOfMonth(ym);
    const empty = $("#readerEmpty");
    const book = $("#book");
    const bottom = $(".reader-bottom");
    const prog = $("#readerProgress");
    if (!entries.length) {
      if (empty) empty.style.display = "block";
      if (book) book.style.display = "none";
      if (bottom) bottom.style.display = "none";
      if (prog) prog.textContent = "";
      return;
    }
    if (empty) empty.style.display = "none";
    if (book) book.style.display = "block";
    if (bottom) bottom.style.display = "flex";
    if (readerIdx >= entries.length) readerIdx = entries.length - 1;
    if (readerIdx < 0) readerIdx = 0;
    renderBookPage(readerIdx);
    if (prog) prog.textContent = (readerIdx + 1) + " / " + entries.length;
  }
  function renderBookPage(i) {
    const entries = dailyEntriesOfMonth(readerYm);
    const e = entries[i];
    const page = $("#bookPage");
    if (!e || !page) return;
    const dt = new Date(e.date + "T00:00:00");
    const wd = ["日", "一", "二", "三", "四", "五", "六"][dt.getDay()];
    const mood = DAILY_MOODS.find((x) => x.key === e.mood);
    const sticker = stickerSvg(e.sticker);
    const imgs = (e.images || []).map((src) => '<img src="' + src + '" />').join("");
    page.innerHTML =
      '<div class="bp-date">' + e.date + ' <span class="bp-week">周' + wd + (e.time ? " · " + (e.time || "").slice(0, 5) : "") + '</span></div>' +
      (mood ? '<span class="bp-mood" style="background:' + mood.color + '">' + mood.label + '</span>' : "") +
      '<div class="bp-text">' + escapeHtml(e.text || "") + '</div>' +
      (imgs ? '<div class="bp-media">' + imgs + '</div>' : "") +
      (sticker ? '<div class="bp-sticker">' + sticker + '</div>' : "");
  }
  function flipReader(dir) {
    const entries = dailyEntriesOfMonth(readerYm);
    const page = $("#bookPage");
    if (!page) return;
    const ni = readerIdx + dir;
    if (ni < 0 || ni >= entries.length) return;
    const outCls = dir > 0 ? "flip-out-next" : "flip-out-prev";
    const inCls = dir > 0 ? "flip-in-next" : "flip-in-prev";
    page.classList.add(outCls);
    setTimeout(() => {
      readerIdx = ni;
      renderBookPage(readerIdx);
      page.classList.remove(outCls);
      page.classList.add(inCls);
      const prog = $("#readerProgress");
      if (prog) prog.textContent = (readerIdx + 1) + " / " + entries.length;
      setTimeout(() => page.classList.remove(inCls), 260);
    }, 210);
  }
  function bindBookSwipe() {
    const book = $("#book");
    if (!book) return;
    let sx = 0, sy = 0, t0 = 0;
    book.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; t0 = Date.now();
    }, { passive: true });
    book.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && Date.now() - t0 < 600) flipReader(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function renderOverview() {
    const ym = readerYm;
    const op = ym.split("-");
    const oy = parseInt(op[0], 10), om = parseInt(op[1], 10);
    const title = $("#ovTitle");
    if (title) title.textContent = "📚 " + oy + "年" + om + "月 概览";
    const grid = $("#ovGrid");
    const empty = $("#ovEmpty");
    if (!grid) return;
    const entries = dailyEntriesOfMonth(ym);
    if (!entries.length) { grid.innerHTML = ""; if (empty) empty.style.display = "block"; return; }
    if (empty) empty.style.display = "none";
    grid.innerHTML = entries.map((e, i) => {
      const dt = new Date(e.date + "T00:00:00");
      const img = (e.images && e.images[0]) ? '<div class="ov-card-media"><img src="' + e.images[0] + '"/></div>' : "";
      return '<div class="ov-card" data-idx="' + i + '"><div class="ov-card-date">' + e.date + (e.time ? " " + (e.time || "").slice(0, 5) : "") + '</div><div class="ov-card-text">' + escapeHtml((e.text || "（无文字）").slice(0, 60)) + '</div>' + img + '</div>';
    }).join("");
    $$(".ov-card", grid).forEach((c) => c.addEventListener("click", () => {
      readerIdx = parseInt(c.dataset.idx, 10);
      readerYm = ym;
      monthbookYm = ym;
      showDailyScreen("reader");
    }));
  }

  function openEditor(opts) {
    opts = opts || {};
    editorId = opts.id || null;
    editorPendingImages = [];
    editorSticker = "";
    const entry = editorId ? getDailyEntry(editorId) : null;
    const title = $("#editorTitle");
    if (title) title.textContent = entry ? "✏️ 编辑手账" : "✏️ 写手账";
    const date = opts.date || (entry && entry.date) || todayStr();
    const dEl = $("#editorDate"); if (dEl) dEl.value = date;
    const now = new Date();
    const tEl = $("#editorTime");
    if (tEl) tEl.value = (entry && entry.time) ? entry.time : String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const tx = $("#editorText");
    if (tx) { tx.value = entry ? (entry.text || "") : ""; }
    renderMoodChips(entry ? entry.mood : null);
    editorSticker = entry ? (entry.sticker || "") : "";
    renderStickerPreview();
    if (entry) editorPendingImages = (entry.images || []).slice();
    renderEditorPhotos();
    const del = $("#editorDelete");
    if (del) del.style.display = entry ? "inline-block" : "none";
    showDailyScreen("editor");
  }
  function renderMoodChips(activeKey) {
    const box = $("#editorMoods");
    if (!box) return;
    box.innerHTML = DAILY_MOODS.map((m) =>
      '<button type="button" class="mood-chip' + (m.key === activeKey ? " active" : "") + '" data-mood="' + m.key + '">' + m.label + '</button>'
    ).join("");
    $$(".mood-chip", box).forEach((b) => b.addEventListener("click", () => {
      $$(".mood-chip", box).forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    }));
  }
  function renderStickerPreview() {
    const p = $("#editorStickerPreview");
    if (p) p.innerHTML = stickerSvg(editorSticker);
    $$(".sticker-opt").forEach((b) => b.classList.toggle("active", b.dataset.sticker === editorSticker));
  }
  function renderEditorPhotos() {
    const box = $("#editorPhotos");
    if (!box) return;
    box.innerHTML = editorPendingImages.map((src, i) =>
      '<div class="paper-photo-thumb"><img src="' + src + '"/><button class="paper-photo-del" data-i="' + i + '">×</button></div>'
    ).join("");
    $$(".paper-photo-del", box).forEach((b) => b.addEventListener("click", () => {
      editorPendingImages.splice(parseInt(b.dataset.i, 10), 1);
      renderEditorPhotos();
    }));
  }
  function compressImage(file, maxWidth, quality) {
    maxWidth = maxWidth || 1200; quality = quality || 0.8;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  async function handleEditorFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      editorPendingImages.push(dataUrl);
      renderEditorPhotos();
    } catch (e) { alert("图片处理失败，换一张试试～"); }
    input.value = "";
  }
  function saveEntry() {
    dailyNorm();
    const date = $("#editorDate").value || todayStr();
    const time = $("#editorTime").value || "08:00";
    const text = $("#editorText").value.trim();
    const moodEl = $(".mood-chip.active");
    const mood = moodEl ? moodEl.dataset.mood : null;
    if (!text && !editorPendingImages.length) { alert("写点什么或加张图再保存吧～"); return; }
    if (editorId) {
      const e = getDailyEntry(editorId);
      if (e) { e.date = date; e.time = time; e.text = text; e.mood = mood; e.sticker = editorSticker; e.images = editorPendingImages.slice(); e.updatedAt = Date.now(); }
    } else {
      state.daily.entries.push({ id: uid(), date, time, text, mood, sticker: editorSticker, images: editorPendingImages.slice(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    saveAll();
    monthbookYm = date.slice(0, 7);
    readerYm = monthbookYm;
    readerIdx = dailyEntriesOfMonth(readerYm).length - 1;
    if (readerIdx < 0) readerIdx = 0;
    showDailyScreen("monthbook");
  }
  function deleteEntry() {
    if (!editorId) return;
    if (!confirm("删除这条手账记录？")) return;
    state.daily.entries = state.daily.entries.filter((x) => x.id !== editorId);
    saveAll();
    editorId = null;
    showDailyScreen("monthbook");
  }

  // ---- 封面 / 阅览 / 概览 / 编辑 事件绑定 ----
  $("#coverOpenBtn").addEventListener("click", () => { const cm = $("#coverMonth"); monthbookYm = (cm && cm.value) || monthStr(); readerIdx = 0; showDailyScreen("monthbook"); });
  $("#coverMonth").addEventListener("change", () => { const cm = $("#coverMonth"); if (cm) { monthbookYm = cm.value || monthStr(); buildCoverCalendar(monthbookYm); } });
  $("#coverNewBtn").addEventListener("click", () => { const cm = $("#coverMonth"); openEditor({ date: defaultNewDate((cm && cm.value) || monthStr()) }); });
  $("#readerBack").addEventListener("click", () => showDailyScreen("monthbook"));
  $("#readerOverview").addEventListener("click", () => showDailyScreen("overview"));
  $("#readerMonth").addEventListener("change", () => { const rm = $("#readerMonth"); readerYm = (rm && rm.value) || monthStr(); monthbookYm = readerYm; readerIdx = 0; renderReader(); });
  $("#readerEdit").addEventListener("click", () => { const e = dailyEntriesOfMonth(readerYm)[readerIdx]; if (e) openEditor({ id: e.id }); });
  $("#readerAdd").addEventListener("click", () => openEditor({ date: defaultNewDate(readerYm) }));
  $("#readerEmptyNew").addEventListener("click", () => openEditor({ date: defaultNewDate(readerYm) }));
  $("#bookPrev").addEventListener("click", () => flipReader(-1));
  $("#bookNext").addEventListener("click", () => flipReader(1));
  $("#monthbookBack").addEventListener("click", () => showDailyScreen("cover"));
  $("#monthbookOverview").addEventListener("click", () => showDailyScreen("overview"));
  $("#monthbookFlip").addEventListener("click", () => { readerYm = monthbookYm; readerIdx = 0; showDailyScreen("reader"); });
  $("#monthbookAdd").addEventListener("click", () => openEditor({ date: defaultNewDate(monthbookYm) }));
  $("#monthbookEmptyNew").addEventListener("click", () => openEditor({ date: defaultNewDate(monthbookYm) }));
  $("#editorBack").addEventListener("click", () => showDailyScreen("monthbook"));
  $("#editorSave").addEventListener("click", saveEntry);
  $("#editorDelete").addEventListener("click", deleteEntry);
  $("#editorCamera").addEventListener("change", () => handleEditorFile($("#editorCamera")));
  $("#editorGallery").addEventListener("change", () => handleEditorFile($("#editorGallery")));
  $$(".sticker-opt").forEach((b) => b.addEventListener("click", () => { editorSticker = b.dataset.sticker; renderStickerPreview(); }));
  $("#ovBack").addEventListener("click", () => showDailyScreen("monthbook"));
  $("#dailyAddBtn").addEventListener("click", () => openEditor({ date: defaultNewDate(dailyScreen === "monthbook" ? monthbookYm : monthStr()) }));
  bindBookSwipe();

  /* =========================================================
     初始化
     ========================================================= */
  els.dateInput.value = todayStr();
  $("#wDateInput").value = todayStr();
  diet.foodDate.value = todayStr();
  if (state.goal) $("#goalInput").value = state.goal;
  refreshCats();
  renderMonth();
  renderDiet();
  renderPlan(planDate());
  renderFood(planDate());

  if (diet.weekToggle && diet.weekPlan) {
    diet.weekToggle.addEventListener("click", () => {
      const shown = diet.weekPlan.style.display !== "none";
      diet.weekPlan.style.display = shown ? "none" : "block";
      diet.weekToggle.textContent = shown ? "📆 本周" : "📅 隐藏";
      if (!shown) renderWeekPlan(diet.foodDate.value || todayStr());
    });
  }

  renderBakeCats();
  renderBakeVideos();
  renderRecipes();
  renderHot(); // 渲染热点小报
  renderBp(); // 渲染血压模块
  renderCover(); // 渲染日常手账本封面
  scheduleBpReminders();
  saveAll(); // 持久化合并后的默认类别等

  // 点击遮罩关闭弹窗
  $$(".modal-mask").forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("show"); })
  );
  // 食谱详情遮罩关闭时顺手停掉计时器
  $("#recipeViewModal").addEventListener("click", (e) => { if (e.target === e.currentTarget) rvPause(); });

  /* =========================================================
     数据备份 / 恢复（防止换链接或换手机丢数据）
     ========================================================= */
  function renderAll() {
    refreshCats();
    renderMonth();
    renderDiet();
    renderPlan(diet.foodDate.value || todayStr());
    renderFood(diet.foodDate.value || todayStr());
    renderBakeCats();
    renderBakeVideos();
    renderRecipes();
    renderHot();
    renderBp();
    renderCover();
  }

  async function exportBackup() {
    let photos = [];
    try { photos = await dbGetAll(); } catch (e) { photos = []; }
    const data = {
      _app: "小熊工作台",
      _ver: 1,
      exportedAt: new Date().toISOString(),
      state: {
        records: state.records,
        cats: state.cats,
        weights: state.weights,
        goal: state.goal,
        profile: state.profile,
        recipes: state.recipes,
        checkins: state.checkins,
        bakeSeeds: state.bakeSeeds,
        favs: state.favs,
        favCols: state.favCols,
        bakeNotes: state.bakeNotes,
        hot: state.hot,
        shopping: state.shopping,
        bp: state.bp,
        daily: state.daily,
      },
      photos,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = "小熊工作台备份_" + ts + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !data.state) { alert("文件格式不对，无法导入 😢"); return; }
      if (!confirm("导入会覆盖当前所有数据，确定继续吗？\n（建议先点「备份」导出一份再导入）")) return;
      const s = data.state;
      if (Array.isArray(s.records)) state.records = s.records;
      if (s.cats) state.cats = mergeCats(s.cats);
      if (Array.isArray(s.weights)) state.weights = s.weights;
      state.goal = (s.goal === undefined ? null : s.goal);
      state.profile = (s.profile === undefined ? null : s.profile);
      if (Array.isArray(s.recipes)) state.recipes = s.recipes;
      if (s.checkins && typeof s.checkins === "object") state.checkins = s.checkins;
      if (s.bakeSeeds && typeof s.bakeSeeds === "object") state.bakeSeeds = s.bakeSeeds;
      if (s.favs && typeof s.favs === "object") state.favs = s.favs;
      if (Array.isArray(s.favCols)) state.favCols = s.favCols;
      if (s.bakeNotes && typeof s.bakeNotes === "object") state.bakeNotes = s.bakeNotes;
      if (s.hot && typeof s.hot === "object") state.hot = s.hot;
      if (Array.isArray(s.shopping)) state.shopping = s.shopping;
      if (s.bp && typeof s.bp === "object") state.bp = s.bp;
      if (s.daily && typeof s.daily === "object") state.daily = s.daily;
      saveAll();
      try {
        await dbClearAll();
        if (Array.isArray(data.photos)) {
          for (const p of data.photos) { try { await dbAdd(p); } catch (e) {} }
        }
      } catch (e) { console.warn("照片恢复失败", e); }
      renderAll();
      alert("恢复成功 🎉 数据已导入");
    } catch (e) {
      alert("导入失败：" + (e && e.message ? e.message : e));
    }
  }

  $("#exportBtn").addEventListener("click", exportBackup);
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) importBackup(f);
    e.target.value = "";
  });
})();
