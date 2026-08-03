#!/usr/bin/env node
/**
 * 每日抖音热点选题报告生成器
 * -------------------------------------------------------------
 * 数据源：抖音公开热榜聚合接口（多源兜底），按关键词归入
 *   👶 亲子育儿 / 💼 职场生活 / 🎬 综合泛娱乐 三类，
 *   为每条热点生成「短视频选题 + 拍摄思路 + 优先级 + 风险提示」，
 *   并汇总「今日流量趋势总结（优先拍 / 次优先 / 备选）」。
 *
 * 用法（GitHub Actions 每日 08:00 北京时间自动跑，无需手动）：
 *   node scripts/fetch-hot.js          # 拉取实时抖音热榜 → hot-report.json
 *   node scripts/fetch-hot.js --mock   # 无网络时用内置样例池生成（本地预览用）
 *
 * 输出：仓库根目录 hot-report.json（与 index.html 同源，前端直接 fetch，无 CORS）
 */
const fs = require('fs');
const path = require('path');

const USE_MOCK = process.argv.includes('--mock');

const CATS = [
  { key: 'parent', name: '亲子育儿', emoji: '👶' },
  { key: 'work', name: '职场生活', emoji: '💼' },
  { key: 'fun', name: '综合泛娱乐', emoji: '🎬' },
];

// 内置样例池（mock / 接口全挂时兜底）
const POOL = {
  parent: [
    '孩子写作业拖拉怎么办', '二胎家庭的平衡术', '孩子挑食怎么破', '亲子阅读真的有用吗',
    '幼儿园选公立还是私立', '孩子手机成瘾家长怎么做', '辅导作业血压飙升现场', '带娃露营装备清单',
    '孩子社恐要不要管', '早餐怎么做得又快又营养',
  ],
  work: [
    '打工人通勤两小时实录', '副业月入过千的普通人', '被领导画饼怎么破', '裸辞后我后悔了吗',
    '职场新人避坑指南', '工资不涨物价涨', '远程办公是福是祸', '同事甩锅怎么优雅回击',
    '35岁职场焦虑真相', '汇报PPT怎么做才高级',
  ],
  fun: [
    '明星同款挑战翻车现场', '周末去哪玩性价比最高', '这部剧为什么这么上头', '网红小吃实测翻车',
    '演唱会全程大合唱名场面', '新手化妆避坑', '宠物成精日常', 'City Walk 路线推荐',
    '怀旧金曲一秒泪目', '电影彩蛋你发现了吗',
  ],
};

// 关键词 → 分类（实时模式自动归类）
const KEYWORDS = {
  parent: ['孩子', '育儿', '亲子', '宝宝', '家长', '教育', '作业', '早教', '母婴', '学校', '老师', '幼儿园', '小学', '补习', '带娃'],
  work: ['职场', '打工', '工资', '老板', '副业', '失业', '面试', '内卷', '加班', '上班', '创业', '领导', '同事', '辞职', '通勤', '汇报'],
  fun: ['明星', '电影', '综艺', '游戏', '网红', '搞笑', '爱情', '剧情', '音乐', '舞蹈', '演唱会', '热搜', '挑战', '追', '宠物', '打卡', '旅游', '美食'],
};

// 公开热榜聚合接口（任一可用即可；均不带鉴权、服务端可直连）
const APIS = [
  'https://api.vvhan.com/api/hotlist/douyin',
  'https://tenapi.cn/v2/douyinhot',
  'https://www.oioweb.cn/api/douyin_hot',
];

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function classify(text) {
  let best = 'fun', score = 0;
  for (const cat of Object.keys(KEYWORDS)) {
    let s = 0;
    for (const k of KEYWORDS[cat]) if (text.includes(k)) s++;
    if (s > score) { score = s; best = cat; }
  }
  return best;
}

function angleFor(catKey, topic, rank) {
  const lead = rank < 10 ? '（当前强热度，建议今天优先拍）' : '';
  const map = {
    parent: '视频选题：《' + topic + '》家长最关心的 3 个瞬间\n拍摄思路：① 开头用真实带娃镜头+字幕痛点钩子；② 中段给 3 个可立刻用的小妙招（字幕条+演示）；③ 结尾抛互动「你家也这样吗」引导评论。' + lead,
    work: '视频选题：《' + topic + '》打工人共鸣选题\n拍摄思路：① 开头抛一个扎心场景引发共鸣；② 中段拆解 1 个可复制的应对模板；③ 结尾用「收藏＝下次用得上」促转发。' + lead,
    fun: '视频选题：《' + topic + '》泛娱乐蹭热点玩法\n拍摄思路：① 开头用热点名场面/反差抢注意力；② 中段做点评或模仿秀；③ 结尾引导二创「你也来试试」。' + lead,
  };
  return map[catKey] || map.fun;
}

function riskFor(topic) {
  if (/(政治|疫情|事故|伤亡|争议|辱|贪|违法|敏感)/.test(topic)) return '涉及敏感话题，建议规避或仅做正向科普';
  return '';
}

async function fetchTopics() {
  for (const url of APIS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const j = await r.json();
      const arr = j?.data?.list || j?.data || j?.list || (Array.isArray(j) ? j : null);
      if (!arr) continue;
      const topics = arr
        .map((it) => (typeof it === 'string' ? it : (it.title || it.word || it.topic || it.hotword || it.name || '')))
        .filter((s) => s && s.trim().length > 1)
        .slice(0, 50);
      if (topics.length) return topics;
    } catch (e) { /* 试下一个源 */ }
  }
  return null;
}

function buildReport(topics) {
  const buckets = { parent: [], work: [], fun: [] };
  topics.forEach((t, i) => {
    const cat = classify(t);
    const heat = i < 10 ? '持续升温' : i < 25 ? '稳定热度' : '即将降温';
    buckets[cat].push({ topic: t, kw: '抖音热搜', heat, angle: angleFor(cat, t, i), risk: riskFor(t) });
  });
  // 保证三类都有内容：从 fun 平移补足（避免某类为空）
  for (const cat of ['parent', 'work', 'fun']) {
    let guard = 0;
    while (buckets[cat].length < 6 && buckets.fun.length > buckets[cat].length && guard < 40) {
      const move = buckets.fun.find((x) => !buckets[cat].includes(x));
      if (!move) break;
      buckets[cat].push(move);
      buckets.fun = buckets.fun.filter((x) => x !== move);
      guard++;
    }
  }
  const categories = CATS.map((c) => ({
    key: c.key, name: c.name, emoji: c.emoji,
    items: buckets[c.key].slice(0, 12),
  }));
  const all = topics.map((t, i) => ({ topic: t, heat: i < 10 ? '持续升温' : i < 25 ? '稳定热度' : '即将降温' }));
  const first = all.filter((x) => x.heat === '持续升温').slice(0, 8).map((x) => x.topic);
  const second = all.filter((x) => x.heat === '稳定热度').slice(0, 8).map((x) => x.topic);
  const backup = all.filter((x) => x.heat === '即将降温').slice(0, 8).map((x) => x.topic);
  const trend = {
    summary: '今日抖音共监测到 ' + topics.length + ' 条热搜。其中「持续升温」类适合今天立刻冲量、前 3 秒强钩子最容易起量；「稳定热度」可作日常更新；「即将降温」建议尽快清掉库存选题。',
    first: first.length, second: second.length, backup: backup.length, total: topics.length,
    firstTopics: first, secondTopics: second, backupTopics: backup,
  };
  return { date: todayStr(), generatedAt: new Date().toISOString(), source: 'douyin-hot', categories, trend };
}

(async () => {
  let topics;
  if (USE_MOCK) {
    topics = [];
    for (const cat of Object.keys(POOL)) for (const t of POOL[cat]) topics.push(t);
    topics = topics.sort(() => Math.random() - 0.5);
  } else {
    topics = await fetchTopics();
    if (!topics) {
      console.error('[fetch-hot] 所有抖音热榜接口均不可用，回退到内置样例池生成报告');
      topics = [];
      for (const cat of Object.keys(POOL)) for (const t of POOL[cat]) topics.push(t);
      topics = topics.sort(() => Math.random() - 0.5);
    }
  }
  const report = buildReport(topics);
  const out = path.join(__dirname, '..', 'hot-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log('[fetch-hot] 已生成 hot-report.json，日期=' + report.date + '，分类条目：' + report.categories.map((c) => c.key + ':' + c.items.length).join(' '));
})();
