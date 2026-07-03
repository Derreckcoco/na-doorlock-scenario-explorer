/**
 * 用户旅程引擎 v5 — 卡片六段式：目标 / 用户状态 / 旅程图 / 情绪 / 前后步 / 痛点
 */
import {
  EVENT_CTX, RESIDENTIAL_CTX, HOUSING_CTX, PHASE_META, buildCtx,
} from './journey-data.js';
import {
  composePhaseSteps,
  composeScenarioGoals,
  composeUserState,
  composeScenarioEmotion,
  composePainPoints,
  composeMomentOfTruth,
} from './story-composer.js';

export { EVENT_CTX, RESIDENTIAL_CTX, HOUSING_CTX };

const GLOBAL_PHASE_ORDER = ['出门前', '离家', '长期离家', '回家前', '开门', '夜间', '门内', '居家'];

function withMomentEnsured(seq, moment) {
  if (seq.includes(moment)) return seq;
  const idx = GLOBAL_PHASE_ORDER.indexOf(moment);
  let insertAt = seq.length;
  for (let i = 0; i < seq.length; i++) {
    if (GLOBAL_PHASE_ORDER.indexOf(seq[i]) > idx) { insertAt = i; break; }
  }
  const copy = [...seq];
  copy.splice(insertAt, 0, moment);
  return copy;
}

function getJourneyPhases(scenario) {
  const { moment, event } = scenario;
  const arrive = moment === '夜间' ? '夜间' : '开门';
  const settle = moment === '居家' ? '居家' : '门内';
  const depart = moment === '长期离家' ? '长期离家' : '离家';

  const HOUSEHOLD_TEMPLATES = {
    派对: ['出门前', '开门', '门内', '离家'],
    节日: ['出门前', '开门', '门内', '离家'],
    装修: ['开门', '门内', '出门前', '离家'],
    搬家: ['出门前', '开门', '门内', '离家'],
  };
  if (HOUSEHOLD_TEMPLATES[event]) {
    const seq = HOUSEHOLD_TEMPLATES[event];
    return seq.includes(moment) ? seq : [...seq, moment];
  }

  if (event === '取包裹') {
    return moment === '居家'
      ? ['居家', arrive, '门内']
      : withMomentEnsured(['回家前', arrive, settle], moment);
  }
  if (event === '倒垃圾') {
    return withMomentEnsured(['出门前', depart, '回家前', arrive], moment);
  }
  if (event === '遛狗') {
    return withMomentEnsured(['出门前', depart, '回家前', arrive, settle], moment);
  }
  if (event === '旅游' || event === '出差') {
    return withMomentEnsured(['出门前', depart, '长期离家', '回家前', arrive, settle], moment);
  }
  return withMomentEnsured(['出门前', depart, '回家前', arrive, settle], moment);
}

function getFocusWindow(scenario) {
  const seq = getJourneyPhases(scenario);
  let idx = seq.indexOf(scenario.moment);
  if (idx === -1) idx = 0;
  return {
    before: idx > 0 ? seq[idx - 1] : null,
    current: seq[idx],
    after: idx < seq.length - 1 ? seq[idx + 1] : null,
  };
}

function buildAdjacentStep(phaseName, scenario) {
  if (!phaseName) return null;
  const meta = PHASE_META[phaseName] || { label: phaseName, icon: '•' };
  const steps = composePhaseSteps(scenario, phaseName);
  return {
    phase: phaseName,
    label: meta.label,
    icon: meta.icon,
    brief: steps[0]?.action || `${meta.label}阶段`,
  };
}

export function buildDetailedJourney(scenario) {
  const { before, current, after } = getFocusWindow(scenario);
  const c = buildCtx(scenario);
  const focusSteps = composePhaseSteps(scenario, current);
  const focusMeta = PHASE_META[current] || { label: current, icon: '•', desc: '' };

  return {
    goals: composeScenarioGoals(scenario),
    userState: composeUserState(scenario),
    emotion: composeScenarioEmotion(scenario),
    journey: {
      moment: current,
      label: focusMeta.label,
      icon: focusMeta.icon,
      desc: focusMeta.desc,
      steps: focusSteps,
    },
    before: buildAdjacentStep(before, scenario),
    after: buildAdjacentStep(after, scenario),
    painPoints: composePainPoints(scenario, focusSteps),
    focusMoment: scenario.moment,
    mot: composeMomentOfTruth(scenario),
    // 兼容旧字段（列表预览等）
    persona: {
      name: scenario.person.name,
      group: scenario.person.group,
      role: c.profile.role,
      goals: composeScenarioGoals(scenario),
      traits: [],
      credential: c.profile.credential,
    },
    context: {
      summary: `${scenario.residential} · ${scenario.housingUsage} · ${scenario.event}`,
    },
    phases: [
      before && { ...buildAdjacentStep(before, scenario), role: 'before', isFocus: false },
      {
        phase: current,
        label: focusMeta.label,
        icon: focusMeta.icon,
        role: 'focus',
        isFocus: true,
        steps: focusSteps,
        emotion: composeScenarioEmotion(scenario).label,
      },
      after && { ...buildAdjacentStep(after, scenario), role: 'after', isFocus: false },
    ].filter(Boolean),
  };
}
