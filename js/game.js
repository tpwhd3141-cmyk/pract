import { PATH, pointAtDistance, distanceToPath } from "./path.js";
import { TOWER_DEFS, Tower } from "./towers.js";
import { Orc, buildAllWaves } from "./orcs.js";

const TOTAL_WAVES = 15; // 스폰 데이터 생성에만 쓰이는 내부 기준값(HUD에는 노출 안 함)
const MIN_PLACE_DIST_TO_PATH = 34;
const MIN_PLACE_DIST_TO_TOWER = 38;

class Projectile {
  constructor(x, y, target, damage, speed, splashRadius, color) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.splashRadius = splashRadius;
    this.color = color;
    this.dead = false;
  }
  update(dt, onImpact) {
    if (this.target.dead || this.target.reachedBase) {
      this.dead = true;
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const move = this.speed * dt;
    if (move >= dist || dist < 4) {
      onImpact(this, this.target.x, this.target.y);
      this.dead = true;
    } else {
      this.x += (dx / dist) * move;
      this.y += (dy / dist) * move;
    }
  }
}

export class Game {
  constructor(canvas, mods) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mods = mods;
    this.reset();
  }

  reset() {
    this.gold = this.mods.startGold;
    this.baseHp = this.mods.baseHp;
    this.maxBaseHp = this.mods.baseHp;
    this.orcs = [];
    this.towers = [];
    this.projectiles = [];
    // 웨이브 개념 없이 전체 분량을 한 번에 생성 - 텀 없이 계속 쏟아진다.
    this.spawnQueue = buildAllWaves(TOTAL_WAVES);
    this.totalToSpawn = this.spawnQueue.length;
    this.elapsed = 0;
    this.selectedTowerType = null;
    this.orcsKilled = 0;
    this.running = true;
    this.ended = false;
    this.victory = false;
    this.lastTime = 0;
    this._raf = null;
    this.speedMultiplier = 1;
  }

  setSpeed(mult) {
    this.speedMultiplier = mult;
  }

  start(onUpdate, onEnd) {
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    this._raf = requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  loop(ts) {
    if (!this.lastTime) this.lastTime = ts;
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    if (this.running) {
      // dt 자체를 늘리지 않고 같은 dt로 update()를 여러 번 돌린다.
      // (dt를 직접 배로 늘리면 투사체가 타겟을 스쳐 지나가거나 오크가
      // 경로 판정을 건너뛰는 등 고배속에서 충돌/판정이 깨질 수 있음)
      const steps = Math.max(1, Math.round(this.speedMultiplier));
      for (let i = 0; i < steps && this.running; i++) {
        this.update(dt);
      }
    }
    this.render();
    if (this.onUpdate) this.onUpdate(this);
    if (this.running) this._raf = requestAnimationFrame((t) => this.loop(t));
  }

  damageOrc(orc, amount) {
    if (orc.dead) return;
    orc.hp -= amount;
    if (orc.hp <= 0 && !orc.dead) {
      orc.dead = true;
      this.gold += orc.reward;
      this.orcsKilled++;
    }
  }

  fireTower(tower, target) {
    const def = tower.def;
    if (def.pierce) {
      // 레이저: 즉시 관통 데미지. 타겟 및 타겟 뒤쪽(진행거리가 짧은) 근접 오크들도 타격.
      tower.beamTimer = 0.12;
      tower.beamTarget = { x: target.x, y: target.y };
      this.damageOrc(target, tower.damage);
      for (const orc of this.orcs) {
        if (orc === target || orc.dead) continue;
        const behind = target.traveled - orc.traveled;
        if (behind >= 0 && behind < 40 && Math.hypot(orc.x - target.x, orc.y - target.y) < 60) {
          this.damageOrc(orc, tower.damage);
        }
      }
      return;
    }
    const proj = new Projectile(
      tower.x,
      tower.y,
      target,
      tower.damage,
      def.projectileSpeed,
      def.splashRadius,
      def.color
    );
    this.projectiles.push(proj);
  }

  update(dt) {
    if (this.ended) return;

    // 웨이브 텀 없이 전체 스폰 큐를 경과 시간 기준으로 계속 흘려보낸다.
    this.elapsed += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].delay <= this.elapsed) {
      const s = this.spawnQueue.shift();
      this.orcs.push(new Orc(s.typeId, s.waveNumber));
    }
    // 스폰할 오크가 남지 않고 필드에도 오크가 없으면 전부 막아낸 것 -> 승리
    if (this.elapsed > 0.5 && this.spawnQueue.length === 0 && this.orcs.length === 0) {
      this.finish(true);
      return;
    }

    // 오크 이동
    for (const orc of this.orcs) {
      if (orc.dead) continue;
      orc.update(dt);
    }

    // 기지 도달 처리
    for (const orc of this.orcs) {
      if (orc.reachedBase && !orc.dead) {
        this.baseHp -= orc.dmg;
        orc.dead = true; // 제거 표시(보상 없음)
      }
    }
    if (this.baseHp <= 0) {
      this.baseHp = 0;
      this.finish(false);
      return;
    }

    // 죽었거나 기지에 도달한 오크 제거
    this.orcs = this.orcs.filter((o) => !o.dead);

    // 타워 발사
    for (const tower of this.towers) {
      tower.update(dt, this.orcs, (t, target) => this.fireTower(t, target));
    }

    // 투사체 갱신
    for (const p of this.projectiles) {
      p.update(dt, (proj, ix, iy) => {
        if (proj.splashRadius > 0) {
          for (const orc of this.orcs) {
            if (Math.hypot(orc.x - ix, orc.y - iy) <= proj.splashRadius) {
              this.damageOrc(orc, proj.damage);
            }
          }
        } else {
          this.damageOrc(proj.target, proj.damage);
        }
      });
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.orcs = this.orcs.filter((o) => !o.dead);
  }

  finish(victory) {
    this.ended = true;
    this.victory = victory;
    this.running = false;
    if (this.onEnd) this.onEnd({ victory, orcsKilled: this.orcsKilled, totalToSpawn: this.totalToSpawn });
  }

  canPlaceAt(x, y) {
    if (distanceToPath(x, y) < MIN_PLACE_DIST_TO_PATH) return false;
    for (const t of this.towers) {
      if (Math.hypot(t.x - x, t.y - y) < MIN_PLACE_DIST_TO_TOWER) return false;
    }
    if (x < 20 || x > this.canvas.width - 20 || y < 20 || y > this.canvas.height - 20) return false;
    return true;
  }

  tryPlaceTower(x, y, typeId) {
    const def = TOWER_DEFS[typeId];
    if (!def) return false;
    if (this.towers.length >= this.mods.maxTowers) return false; // 슬롯 소진 - 업그레이드 트리에서만 확장 가능
    if (!def.alwaysUnlocked && !this.mods.unlocked.has(typeId)) return false;
    if (this.gold < def.cost) return false;
    if (!this.canPlaceAt(x, y)) return false;
    this.gold -= def.cost;
    this.towers.push(new Tower(x, y, typeId, this.mods));
    return true;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 배경
    ctx.fillStyle = "#0f1a12";
    ctx.fillRect(0, 0, w, h);

    // 경로
    ctx.strokeStyle = "#3a2c1d";
    ctx.lineWidth = 34;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();
    ctx.strokeStyle = "#4a3a26";
    ctx.lineWidth = 26;
    ctx.stroke();

    // 기지
    const basePoint = PATH[PATH.length - 1];
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.arc(basePoint.x, Math.min(basePoint.y, h - 24), 20, 0, Math.PI * 2);
    ctx.fill();

    // 타워
    for (const t of this.towers) {
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
      ctx.stroke();
      if (t.beamTimer > 0 && t.beamTarget) {
        ctx.strokeStyle = t.def.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.beamTarget.x, t.beamTarget.y);
        ctx.stroke();
      }
    }

    // 배치 미리보기
    if (this.selectedTowerType && this.hoverPoint) {
      const def = TOWER_DEFS[this.selectedTowerType];
      const ok = this.canPlaceAt(this.hoverPoint.x, this.hoverPoint.y) && this.gold >= def.cost;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = ok ? def.color : "#ef4444";
      ctx.beginPath();
      ctx.arc(this.hoverPoint.x, this.hoverPoint.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 오크
    for (const orc of this.orcs) {
      ctx.fillStyle = orc.color;
      ctx.beginPath();
      ctx.arc(orc.x, orc.y, orc.radius, 0, Math.PI * 2);
      ctx.fill();
      // 체력바
      const barW = orc.radius * 2;
      ctx.fillStyle = "#000";
      ctx.fillRect(orc.x - barW / 2, orc.y - orc.radius - 8, barW, 4);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(orc.x - barW / 2, orc.y - orc.radius - 8, barW * Math.max(orc.hp, 0) / orc.maxHp, 4);
    }

    // 투사체
    for (const p of this.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export { TOTAL_WAVES };
