import { pointAtDistance, PATH_LENGTH } from "./path.js";

export const ORC_TYPES = {
  normal: { name: "오크", hpMult: 1, speedMult: 1, color: "#84cc16", reward: 2, dmg: 1 },
  fast: { name: "날쌘 오크", hpMult: 0.6, speedMult: 1.8, color: "#facc15", reward: 3, dmg: 1 },
  tank: { name: "중장갑 오크", hpMult: 3.5, speedMult: 0.6, color: "#a3a3a3", reward: 6, dmg: 2 },
  boss: { name: "오크 대장", hpMult: 12, speedMult: 0.8, color: "#dc2626", reward: 25, dmg: 5 },
};

export class Orc {
  constructor(typeId, waveNumber) {
    const t = ORC_TYPES[typeId];
    this.typeId = typeId;
    this.maxHp = Math.round((18 + waveNumber * 7) * t.hpMult);
    this.hp = this.maxHp;
    this.speed = (55 + Math.min(waveNumber * 1.5, 35)) * t.speedMult;
    this.traveled = 0;
    this.dead = false;
    this.reachedBase = false;
    this.rewarded = false;
    this.reward = t.reward;
    this.dmg = t.dmg;
    this.color = t.color;
    this.radius = typeId === "boss" ? 14 : typeId === "tank" ? 11 : 7;
    const p = pointAtDistance(0);
    this.x = p.x;
    this.y = p.y;
  }

  update(dt) {
    this.traveled += this.speed * dt;
    const p = pointAtDistance(this.traveled);
    this.x = p.x;
    this.y = p.y;
    if (this.traveled >= PATH_LENGTH) {
      this.reachedBase = true;
    }
  }
}

// 웨이브 번호에 따라 스폰할 오크 목록(타입 + 딜레이)을 생성
export function buildWave(waveNumber) {
  const list = [];
  const count = 6 + waveNumber * 3;
  const isBossWave = waveNumber % 5 === 0;
  const interval = Math.max(0.18, 0.55 - waveNumber * 0.015);
  let t = 0;
  for (let i = 0; i < count; i++) {
    let typeId = "normal";
    const roll = Math.random();
    if (waveNumber >= 4 && roll < 0.22) typeId = "tank";
    else if (waveNumber >= 3 && roll < 0.4) typeId = "fast";
    list.push({ typeId, delay: t });
    t += interval;
  }
  if (isBossWave) {
    list.push({ typeId: "boss", delay: t + 0.6 });
  }
  return list;
}
