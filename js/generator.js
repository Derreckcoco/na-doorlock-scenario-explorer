import {
  DIMENSIONS,
  flattenPersons,
  MOMENT_EVENT_RELEVANCE,
  HOUSEHOLD_EVENTS,
  RESIDENTIAL_EVENT_ADJ,
  HOUSING_EVENT_ADJ,
  HOUSING_MOMENT_ADJ,
  RESIDENTIAL_HOUSING_ADJ,
  PERSON_EVENT_ADJ,
  PERSON_RESIDENTIAL_ADJ,
  PERSON_GROUP_MOMENT_ADJ,
  RELEVANCE_CAPS,
} from './dimensions.js';
import { buildDetailedJourney, EVENT_CTX, RESIDENTIAL_CTX, HOUSING_CTX } from './journey-engine.js';
import { composeListPreview } from './story-composer.js';

const persons = flattenPersons();
const housingUsages = DIMENSIONS.housingUsage.items;
const moments = DIMENSIONS.moment.items;
const residentials = DIMENSIONS.residential.items;
const events = DIMENSIONS.event.items;

export const TOTAL_COMBINATIONS =
  persons.length *
  housingUsages.length *
  moments.length *
  residentials.length *
  events.length;

const indices = {
  person: persons.length,
  housing: housingUsages.length,
  moment: moments.length,
  residential: residentials.length,
  event: events.length,
};

function decodeIndex(flatIndex) {
  let n = flatIndex;
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
    flatIndex,
  };
}

function calcRelevance(scenario) {
  let score = MOMENT_EVENT_RELEVANCE[scenario.moment]?.[scenario.event] ?? 40;

  score += RESIDENTIAL_EVENT_ADJ[`${scenario.residential}|${scenario.event}`] ?? 0;
  score += HOUSING_EVENT_ADJ[`${scenario.housingUsage}|${scenario.event}`] ?? 0;
  score += HOUSING_MOMENT_ADJ[`${scenario.housingUsage}|${scenario.moment}`] ?? 0;
  score += RESIDENTIAL_HOUSING_ADJ[`${scenario.residential}|${scenario.housingUsage}`] ?? 0;
  score += PERSON_EVENT_ADJ[`${scenario.person.name}|${scenario.event}`] ?? 0;
  score += PERSON_RESIDENTIAL_ADJ[`${scenario.person.name}|${scenario.residential}`] ?? 0;
  score += PERSON_GROUP_MOMENT_ADJ[`${scenario.person.group}|${scenario.moment}`] ?? 0;

  const group = scenario.person.group;
  const isHouseholdEvent = HOUSEHOLD_EVENTS.includes(scenario.event);

  if (group === '物流人员' && !['开门', '回家前', '居家', '夜间'].includes(scenario.moment)) score -= 15;
  if (group === '服务人员' && scenario.moment === '长期离家') score -= 20;
  if (scenario.housingUsage === '空置' && ['门内', '居家'].includes(scenario.moment)) score -= 25;
  if (scenario.housingUsage === '商用' && scenario.person.name === '子女') score -= 10;

  if (isHouseholdEvent && group === '物流人员' && scenario.event !== '搬家') score -= 15;
  if (scenario.event === '搬家' && group === '常住人' && scenario.moment === '夜间') score -= 20;

  for (const { test, cap } of RELEVANCE_CAPS) {
    if (test(scenario)) score = Math.min(score, cap);
  }

  return Math.max(0, Math.min(100, score));
}

const relevanceCache = new Uint8Array(TOTAL_COMBINATIONS);
for (let i = 0; i < TOTAL_COMBINATIONS; i++) {
  relevanceCache[i] = calcRelevance(decodeIndex(i));
}

function scenarioId(flatIndex) {
  return `S-${flatIndex}`;
}

function scenarioTitle(s) {
  const evt = s.event === '日常' ? '' : ` · ${s.event}`;
  return `${s.person.name} · ${s.residential} · ${s.housingUsage} · ${s.moment}${evt}`;
}

function getTopPainPoint(scenario) {
  return composeListPreview(scenario);
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
  const journey = journeyFor(scenario);
  return {
    ...scenario,
    journey,
    painPoints: journey.painPoints,
  };
}

export function matchesFilters(s, filters) {
  if (filters.person?.length && !filters.person.includes(s.person.name)) return false;
  if (filters.housingUsage?.length && !filters.housingUsage.includes(s.housingUsage)) return false;
  if (filters.moment?.length && !filters.moment.includes(s.moment)) return false;
  if (filters.residential?.length && !filters.residential.includes(s.residential)) return false;
  if (filters.event?.length && !filters.event.includes(s.event)) return false;
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

export { persons, housingUsages, moments, residentials, events };
