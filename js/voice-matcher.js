import { USER_VOICES, CAPABILITY_SEEDS } from './user-voice-data.js';

function tagScore(scenario, voice) {
  const t = voice.tags;
  let score = 0;

  if (t.moments?.includes(scenario.moment)) score += 3;
  if (t.events?.includes(scenario.event)) score += 3;
  if (t.personGroups?.includes(scenario.person.group)) score += 2;
  if (t.personNames?.includes(scenario.person.name)) score += 2;
  if (t.housingUsages?.includes(scenario.housingUsage)) score += 2;
  if (t.residentials?.includes(scenario.residential)) score += 1;

  return score;
}

function textScore(haystack, voice) {
  const keywords = voice.tags.keywords || [];
  let score = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) score += 2;
  }
  for (const theme of voice.tags.painThemes || []) {
    const themeWords = theme.split('_');
    if (themeWords.some((w) => haystack.includes(w))) score += 1;
  }
  return score;
}

/**
 * @param {object} scenario
 * @param {{ pains?: string[], frictions?: string[] }} context
 * @param {{ limit?: number, minScore?: number }} opts
 */
export function matchUserVoices(scenario, context = {}, opts = {}) {
  const { limit = 4, minScore = 4 } = opts;
  const haystack = [
    context.pains?.join(' ') || '',
    context.frictions?.join(' ') || '',
    scenario.topPain || '',
  ].join(' ');

  const ranked = USER_VOICES.map((voice) => {
    const score = tagScore(scenario, voice) + textScore(haystack, voice);
    return { voice, score };
  })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || a.voice.id.localeCompare(b.voice.id));

  return ranked.slice(0, limit).map((r) => ({
    ...r.voice,
    matchScore: r.score,
  }));
}

export function countUserVoices(scenario) {
  return matchUserVoices(scenario, {}, { limit: 99, minScore: 4 }).length;
}

export function capabilityHintsForScenario(scenario, voices) {
  const themes = new Set();
  for (const v of voices) {
    for (const t of v.tags.painThemes || []) themes.add(t);
  }
  return CAPABILITY_SEEDS.map((cap) => {
    const overlap = cap.themes.filter((t) => themes.has(t));
    return overlap.length ? { ...cap, overlap, strength: overlap.length } : null;
  })
    .filter(Boolean)
    .sort((a, b) => b.strength - a.strength);
}
