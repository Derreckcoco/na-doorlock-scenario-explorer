import {
  DIMENSIONS,
  flattenPersons,
  MOMENT_EVENT_RELEVANCE,
  MOMENT_ACTIVITY_RELEVANCE,
} from './dimensions.js';
import { buildDetailedJourney } from './journey-engine.js';

const persons = flattenPersons();
const housingUsages = DIMENSIONS.housingUsage.items;
const moments = DIMENSIONS.moment.items;
const residentials = DIMENSIONS.residential.items;
const events = DIMENSIONS.event.items;
const activities = DIMENSIONS.activity.items;

export const TOTAL_COMBINATIONS =
  persons.length *
  housingUsages.length *
  moments.length *
  residentials.length *
  events.length *
  activities.length;

const indices = {
  person: persons.length,
  housing: housingUsages.length,
  moment: moments.length,
  residential: residentials.length,
  event: events.length,
  activity: activities.length,
};

function decodeIndex(flatIndex) {
  let n = flatIndex;
  const activityIdx = n % indices.activity;
  n = Math.floor(n / indices.activity);
  const eventIdx = n % indices.event;
  n = Math.floor(n / indices.event);
  const residentialIdx = n % indices.residential;
  n = Math.floor(n / indices.residential);
  const momentIdx = n % indices.moment;
  n = Math.floor(n / indices.moment);
  const housingIdx = n % indices.housing;
  n = Math.floor(n / indices.housing);
  const personIdx = n % indices.person;

  return {
    person: persons[personIdx],
    housingUsage: housingUsages[housingIdx],
    moment: moments[momentIdx],
    residential: residentials[residentialIdx],
    event: events[eventIdx],
    activity: activities[activityIdx],
    flatIndex,
  };
}

function calcRelevance(scenario) {
  const eventRel = MOMENT_EVENT_RELEVANCE[scenario.moment]?.[scenario.event] ?? 40;
  const actRel = MOMENT_ACTIVITY_RELEVANCE[scenario.moment]?.[scenario.activity] ?? 40;
  let base = Math.round(eventRel * 0.55 + actRel * 0.45);

  if (scenario.activity !== '无特定活动' && ['派对', '节日', '装修', '搬家'].includes(scenario.activity)) {
    base = Math.round(base * 0.7 + actRel * 0.3);
  }
  if (scenario.event === '日常' && scenario.activity === '无特定活动') {
    base = Math.max(base, 45);
  }

  const group = scenario.person.group;
  if (group === '物流人员' && !['开门', '回家前', '居家', '夜间'].includes(scenario.moment)) base -= 15;
  if (group === '服务人员' && scenario.moment === '长期离家') base -= 20;
  if (scenario.housingUsage === '空置' && ['门内', '居家'].includes(scenario.moment)) base -= 25;
  if (scenario.housingUsage === '商用' && scenario.person.name === '子女') base -= 10;

  return Math.max(0, Math.min(100, base));
}

const relevanceCache = new Uint8Array(TOTAL_COMBINATIONS);
for (let i = 0; i < TOTAL_COMBINATIONS; i++) {
  relevanceCache[i] = calcRelevance(decodeIndex(i));
}

function scenarioId(flatIndex) {
  return `S-${flatIndex}`;
}

function scenarioTitle(s) {
  const act = s.activity === '无特定活动' ? '' : ` · ${s.activity}`;
  const evt = s.event === '日常' ? '' : ` · ${s.event}`;
  return `${s.person.name} · ${s.residential} · ${s.housingUsage} · ${s.moment}${evt}${act}`;
}

function painPointsFor(scenario) {
  const pains = [];
  const { person, housingUsage, moment, residential, event, activity } = scenario;
  const g = person.group;

  if (moment === '开门' && g === '物流人员') {
    pains.push('户主不在时难以完成交付或入室');
    pains.push('投递时间窗窄，等待成本高');
  }
  if (moment === '开门' && g === '服务人员') {
    pains.push('预约时间与实际到达不一致');
    pains.push('离开后是否锁门难以确认');
  }
  if (moment === '开门' && g === '访客') {
    pains.push('户主无法及时应门');
    pains.push('临时权限创建繁琐');
  }
  if (person.name === '子女' && ['回家前', '开门'].includes(moment)) {
    pains.push('儿童凭证操作困难');
    pains.push('家长无法即时知晓到家');
  }
  if (person.name === '老人') {
    pains.push('操作复杂、记不住密码');
    pains.push('异常无人知晓');
  }
  if (event === '遛狗' || person.name === '遛狗') {
    pains.push('双手占用、短时外出易忘锁');
    pains.push('宠物冲门导致门未关严');
  }
  if (event === '取包裹' || person.name === '快递') {
    pains.push('Porch Piracy 包裹盗窃风险');
    pains.push('投递与门锁事件无法关联');
  }
  if (housingUsage === 'Airbnb') {
    pains.push('入住/退房换码与清洁衔接');
    pains.push('客人早到或迟退管理难');
  }
  if (housingUsage === '空置') {
    pains.push('任何开门需高优先级告警');
    pains.push('误报与漏报平衡难');
  }
  if (housingUsage === '租赁') {
    pains.push('租客/房东权限边界');
    pains.push('退租后权限残留');
  }
  if (housingUsage === '商用') {
    pains.push('客户到达时服务被打断');
    pains.push('员工排班与开门权限');
  }
  if (moment === '离家' || moment === '出门前') pains.push('匆忙中忘记锁门或确认');
  if (moment === '长期离家') {
    pains.push('多入口是否全部锁闭不确定');
    pains.push('远程授权后忘记撤销');
  }
  if (residential === '公寓' || residential === 'Condo') {
    pains.push('楼道门禁与单元门双层协调');
    pains.push('邻居尾随风险');
  }
  if (residential === '独栋' || residential === '联排') {
    pains.push('多入口（前/后/车库）状态不同步');
  }
  if (residential === '豪宅') pains.push('多角色（员工/宾客）权限分级');
  if (activity === '派对' || activity === '节日') {
    pains.push('高频访客与陌生人混入');
    pains.push('散场后权限/后门未清理');
  }
  if (activity === '装修') {
    pains.push('工人变动频繁、权限难回收');
    pains.push('施工期安防降级');
  }
  if (activity === '搬家') {
    pains.push('门长时间敞开、人员复杂');
    pains.push('搬家结束后安防未恢复');
  }
  if (event === '通勤' || event === '出差') pains.push('双手占用、赶时间操作锁');
  if (moment === '夜间') {
    pains.push('开锁噪音/灯光打扰家人');
    pains.push('深夜安全感不足');
  }
  if (pains.length < 3) {
    pains.push(`${person.name}在${moment}阶段的通行顺畅性`);
    pains.push(`${housingUsage}场景下的权限与审计需求`);
    pains.push(`${residential}户型对门口操作的影响`);
  }
  return [...new Set(pains)].slice(0, 8);
}

/** 返回该场景最核心的一条痛点（列表预览用） */
export function getTopPainPoint(scenario) {
  return painPointsFor(scenario)[0];
}

function journeyFor(scenario) {
  return buildDetailedJourney(scenario);
}

export function buildScenarioLight(flatIndex) {
  const raw = decodeIndex(flatIndex);
  const scenario = {
    ...raw,
    id: scenarioId(flatIndex),
    title: scenarioTitle(raw),
    relevance: relevanceCache[flatIndex],
  };
  scenario.topPain = getTopPainPoint(scenario);
  return scenario;
}

export function buildScenario(flatIndex) {
  const scenario = buildScenarioLight(flatIndex);
  return {
    ...scenario,
    journey: journeyFor(scenario),
    painPoints: painPointsFor(scenario),
  };
}

export function matchesFilters(s, filters) {
  if (filters.person?.length && !filters.person.includes(s.person.name)) return false;
  if (filters.housingUsage?.length && !filters.housingUsage.includes(s.housingUsage)) return false;
  if (filters.moment?.length && !filters.moment.includes(s.moment)) return false;
  if (filters.residential?.length && !filters.residential.includes(s.residential)) return false;
  if (filters.event?.length && !filters.event.includes(s.event)) return false;
  if (filters.activity?.length && !filters.activity.includes(s.activity)) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    if (!s.title.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
  }
  return true;
}

export function queryScenariosAsync(filters, minRelevance, page, pageSize, onProgress, onDone) {
  const start = page * pageSize;
  const end = start + pageSize;
  const items = [];
  let matched = 0;
  let i = 0;
  let cancelled = false;

  function chunk() {
    if (cancelled) return;
    const deadline = performance.now() + 12;

    while (i < TOTAL_COMBINATIONS && performance.now() < deadline) {
      if (relevanceCache[i] >= minRelevance) {
        const s = buildScenarioLight(i);
        if (matchesFilters(s, filters)) {
          if (matched >= start && matched < end) items.push(s);
          matched++;
        }
      }
      i++;
    }

    if (i < TOTAL_COMBINATIONS) {
      onProgress(Math.round((i / TOTAL_COMBINATIONS) * 100));
      requestAnimationFrame(chunk);
    } else {
      onDone({ items, total: matched });
    }
  }

  requestAnimationFrame(chunk);
  return () => { cancelled = true; };
}

export function countFiltered(filters, minRelevance = 0) {
  let count = 0;
  for (let i = 0; i < TOTAL_COMBINATIONS; i++) {
    if (relevanceCache[i] < minRelevance) continue;
    if (!matchesFilters(buildScenarioLight(i), filters)) continue;
    count++;
  }
  return count;
}

export function getScenarioPage(filters, minRelevance, page, pageSize) {
  const start = page * pageSize;
  const end = start + pageSize;
  const items = [];
  let matched = 0;

  for (let i = 0; i < TOTAL_COMBINATIONS; i++) {
    if (relevanceCache[i] < minRelevance) continue;
    const s = buildScenarioLight(i);
    if (!matchesFilters(s, filters)) continue;
    if (matched >= start && matched < end) items.push(s);
    matched++;
    if (matched >= end) break;
  }
  return { items, totalMatched: matched };
}

export { persons, housingUsages, moments, residentials, events, activities };
