// 런이 끝날 때마다 얻는 "정수(essence)"로 구매하는 영구 업그레이드 트리.
// requires 로 선행 노드를 지정해 간단한 트리 구조를 만든다. (1회성 구매)
export const UPGRADE_DEFS = [
  { id: "gold1", name: "경제 강화 I", desc: "런 시작 골드 +50", cost: 10, requires: null, effect: { startGold: 50 } },
  { id: "gold2", name: "경제 강화 II", desc: "시작 골드 +80 추가", cost: 25, requires: "gold1", effect: { startGold: 80 } },

  { id: "hp1", name: "성벽 보강 I", desc: "기지 체력 +25", cost: 10, requires: null, effect: { baseHp: 25 } },
  { id: "hp2", name: "성벽 보강 II", desc: "기지 체력 +30 추가", cost: 22, requires: "hp1", effect: { baseHp: 30 } },

  { id: "unlock_cannon", name: "캐논 타워 해금", desc: "스플래시 데미지 타워를 배치할 수 있습니다", cost: 30, requires: null, effect: { unlock: "cannon" } },
  { id: "unlock_laser", name: "레이저 타워 해금", desc: "관통 데미지 타워를 배치할 수 있습니다", cost: 60, requires: "unlock_cannon", effect: { unlock: "laser" } },

  { id: "essence1", name: "정수 효율 I", desc: "런 종료 시 정수 획득 +20%", cost: 20, requires: null, effect: { essenceMult: 0.2 } },
  { id: "essence2", name: "정수 효율 II", desc: "정수 획득 +25% 추가", cost: 40, requires: "essence1", effect: { essenceMult: 0.25 } },
];

// 레벨형 업그레이드: 티어 제한 없이 레벨 30까지 반복 구매 가능.
// 레벨당 비용은 baseCost + level * costStep (선형 증가).
export const LEVELABLE_DEFS = [
  {
    key: "damage",
    name: "공격력 강화",
    desc: (lvl) => `모든 타워 데미지 +${lvl * 5}% (레벨당 +5%)`,
    effectField: "damageMult",
    perLevel: 0.05,
    maxLevel: 30,
    baseCost: 10,
    costStep: 4,
  },
  {
    key: "fireRate",
    name: "연사 속도",
    desc: (lvl) => `모든 타워 공격 속도 +${lvl * 4}% (레벨당 +4%)`,
    effectField: "fireRateMult",
    perLevel: 0.04,
    maxLevel: 30,
    baseCost: 10,
    costStep: 4,
  },
  {
    key: "range",
    name: "사거리 강화",
    desc: (lvl) => `모든 타워 사거리 +${Math.round(lvl * 2.5)}% (레벨당 +2.5%)`,
    effectField: "rangeMult",
    perLevel: 0.025,
    maxLevel: 30,
    baseCost: 10,
    costStep: 3,
  },
  {
    key: "slots",
    name: "타워 슬롯 확장",
    desc: (lvl) => `설치 가능한 타워 개수 +${lvl}개 (레벨당 +1개)`,
    effectField: "maxTowers",
    perLevel: 1,
    maxLevel: 30,
    baseCost: 20,
    costStep: 15,
  },
];

export function levelCost(def, level) {
  return def.baseCost + level * def.costStep;
}

export function canBuyLevel(meta, def) {
  const level = meta.levels[def.key] || 0;
  if (level >= def.maxLevel) return false;
  return meta.essence >= levelCost(def, level);
}

export function buyLevel(meta, def) {
  if (!canBuyLevel(meta, def)) return false;
  const level = meta.levels[def.key] || 0;
  meta.essence -= levelCost(def, level);
  meta.levels[def.key] = level + 1;
  return true;
}

const STORAGE_KEY = "orcSiegeMeta_v1";

export function loadMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { essence: 0, owned: [], levels: {} };
    const parsed = JSON.parse(raw);
    return {
      essence: parsed.essence || 0,
      owned: parsed.owned || [],
      levels: parsed.levels || {}, // 구버전 세이브 호환 (levels 없으면 전부 0)
    };
  } catch (e) {
    return { essence: 0, owned: [], levels: {} };
  }
}

export function saveMeta(meta) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

// 보유 업그레이드로부터 현재 능력치 보정값 계산
export function computeMods(meta) {
  const mods = {
    damageMult: 0,
    rangeMult: 0,
    fireRateMult: 0,
    startGold: 100,
    baseHp: 100,
    essenceMult: 0,
    maxTowers: 1, // 기본값: 한 번 설치하면 더 이상 설치 불가 (업그레이드로 확장)
    unlocked: new Set(["gun"]),
  };
  for (const id of meta.owned) {
    const def = UPGRADE_DEFS.find((u) => u.id === id);
    if (!def) continue;
    const e = def.effect;
    if (e.damageMult) mods.damageMult += e.damageMult;
    if (e.rangeMult) mods.rangeMult += e.rangeMult;
    if (e.fireRateMult) mods.fireRateMult += e.fireRateMult;
    if (e.startGold) mods.startGold += e.startGold;
    if (e.baseHp) mods.baseHp += e.baseHp;
    if (e.essenceMult) mods.essenceMult += e.essenceMult;
    if (e.maxTowers) mods.maxTowers += e.maxTowers;
    if (e.unlock) mods.unlocked.add(e.unlock);
  }
  for (const def of LEVELABLE_DEFS) {
    const level = meta.levels[def.key] || 0;
    if (!level) continue;
    mods[def.effectField] += def.perLevel * level;
  }
  return mods;
}

export function canBuy(meta, def) {
  if (meta.owned.includes(def.id)) return false;
  if (def.requires && !meta.owned.includes(def.requires)) return false;
  return meta.essence >= def.cost;
}
