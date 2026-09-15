export const TOWER_DEFS = {
  gun: {
    id: "gun",
    name: "기관총",
    cost: 50,
    baseDamage: 8,
    baseRange: 120,
    baseFireRate: 4, // 초당 발사 횟수
    projectileSpeed: 520,
    splashRadius: 0,
    pierce: false,
    color: "#4ade80",
    alwaysUnlocked: true,
    desc: "저렴하고 빠른 기본 타워",
  },
  cannon: {
    id: "cannon",
    name: "캐논",
    cost: 120,
    baseDamage: 26,
    baseRange: 100,
    baseFireRate: 1,
    projectileSpeed: 280,
    splashRadius: 55,
    pierce: false,
    color: "#f97316",
    requiresUpgrade: "unlock_cannon",
    desc: "범위 폭발 데미지",
  },
  laser: {
    id: "laser",
    name: "레이저",
    cost: 200,
    baseDamage: 14,
    baseRange: 170,
    baseFireRate: 2.5,
    projectileSpeed: 0,
    splashRadius: 0,
    pierce: true,
    color: "#60a5fa",
    requiresUpgrade: "unlock_laser",
    desc: "즉시 관통 데미지",
  },
};

export class Tower {
  constructor(x, y, typeId, mods) {
    const def = TOWER_DEFS[typeId];
    this.x = x;
    this.y = y;
    this.typeId = typeId;
    this.def = def;
    this.damage = def.baseDamage * (1 + mods.damageMult);
    this.range = def.baseRange * (1 + mods.rangeMult);
    this.fireRate = def.baseFireRate * (1 + mods.fireRateMult);
    this.cooldown = 0;
    this.radius = 16;
    this.beamTimer = 0; // 레이저 시각효과용
    this.beamTarget = null;
  }

  findTarget(orcs) {
    let target = null;
    let bestTraveled = -1;
    for (const orc of orcs) {
      const dx = orc.x - this.x;
      const dy = orc.y - this.y;
      if (dx * dx + dy * dy <= this.range * this.range) {
        if (orc.traveled > bestTraveled) {
          bestTraveled = orc.traveled;
          target = orc;
        }
      }
    }
    return target;
  }

  update(dt, orcs, onFire) {
    if (this.beamTimer > 0) this.beamTimer -= dt;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const target = this.findTarget(orcs);
    if (target) {
      this.cooldown = 1 / this.fireRate;
      onFire(this, target);
    }
  }
}
