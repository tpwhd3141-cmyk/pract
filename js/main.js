import { Game } from "./game.js";
import { TOWER_DEFS } from "./towers.js";
import {
  UPGRADE_DEFS,
  LEVELABLE_DEFS,
  loadMeta,
  saveMeta,
  computeMods,
  canBuy,
  levelCost,
  canBuyLevel,
  buyLevel,
} from "./upgrades.js";

const screens = {
  menu: document.getElementById("screen-menu"),
  game: document.getElementById("screen-game"),
  upgrades: document.getElementById("screen-upgrades"),
  result: document.getElementById("screen-result"),
};

function showScreen(name) {
  for (const key in screens) {
    screens[key].classList.toggle("active", key === name);
  }
}

let meta = loadMeta();
let game = null;

const SPEED_STEPS = [1, 2, 3, 4, 5];
let speedIndex = 0;

function applySpeedButton() {
  const btn = document.getElementById("btn-speed");
  btn.textContent = `${SPEED_STEPS[speedIndex]}x`;
}

function refreshMenuEssence() {
  document.getElementById("menu-essence").textContent = meta.essence;
}

function startRun() {
  const mods = computeMods(meta);
  const canvas = document.getElementById("game-canvas");
  game = new Game(canvas, mods);
  speedIndex = 0;
  applySpeedButton();
  buildTowerButtons(mods);
  game.start(onGameUpdate, onGameEnd);
  showScreen("game");
}

function buildTowerButtons(mods) {
  const container = document.getElementById("tower-buttons");
  container.innerHTML = "";
  for (const typeId in TOWER_DEFS) {
    const def = TOWER_DEFS[typeId];
    const unlocked = def.alwaysUnlocked || mods.unlocked.has(typeId);
    const btn = document.createElement("button");
    btn.className = "tower-btn";
    btn.dataset.type = typeId;
    btn.disabled = !unlocked;
    btn.innerHTML = unlocked
      ? `<span class="tw-name">${def.name}</span><span class="tw-cost">${def.cost}G</span>`
      : `<span class="tw-name">🔒 ${def.name}</span><span class="tw-cost">업그레이드 필요</span>`;
    btn.title = def.desc;
    btn.addEventListener("click", () => {
      if (!unlocked || btn.disabled) return;
      document.querySelectorAll(".tower-btn").forEach((b) => b.classList.remove("selected"));
      if (game.selectedTowerType === typeId) {
        game.selectedTowerType = null;
      } else {
        game.selectedTowerType = typeId;
        btn.classList.add("selected");
      }
    });
    container.appendChild(btn);
  }
  refreshTowerButtonsSlotState();
}

// 슬롯(설치 가능 개수)이 소진되면 전체 타워 버튼을 잠근다.
function refreshTowerButtonsSlotState() {
  if (!game) return;
  const full = game.towers.length >= game.mods.maxTowers;
  document.querySelectorAll(".tower-btn").forEach((btn) => {
    const typeId = btn.dataset.type;
    const def = TOWER_DEFS[typeId];
    const unlocked = def.alwaysUnlocked || game.mods.unlocked.has(typeId);
    btn.disabled = !unlocked || full;
    if (full) btn.classList.remove("selected");
  });
}

function onGameUpdate(g) {
  document.getElementById("hud-gold").textContent = Math.floor(g.gold);
  document.getElementById("hud-hp").textContent = `${Math.ceil(g.baseHp)} / ${g.maxBaseHp}`;
  document.getElementById("hud-slots").textContent = `${g.towers.length} / ${g.mods.maxTowers}`;
  const remaining = g.spawnQueue.length + g.orcs.length;
  document.getElementById("hud-progress").textContent = `${g.orcsKilled} / ${g.totalToSpawn}`;
  document.getElementById("hud-status").textContent = g.ended
    ? g.victory
      ? "승리!"
      : "기지 함락"
    : remaining > 0
    ? "오크 쇄도 중"
    : "마무리 처치 중";
  refreshTowerButtonsSlotState();
}

function onGameEnd({ victory, orcsKilled, totalToSpawn }) {
  const base = Math.floor(orcsKilled / 4) + (victory ? 30 : 0);
  const earned = Math.round(base * (1 + computeMods(meta).essenceMult));
  meta.essence += earned;
  saveMeta(meta);

  document.getElementById("result-title").textContent = victory ? "승리! 오크의 침공을 막아냈습니다" : "기지가 함락되었습니다";
  document.getElementById("result-title").className = victory ? "win" : "lose";
  document.getElementById("result-waves").textContent = `${orcsKilled} / ${totalToSpawn}`;
  document.getElementById("result-essence").textContent = `+${earned}`;
  showScreen("result");
}

function buildUpgradeTree() {
  const levelContainer = document.getElementById("upgrade-list-levels");
  const container = document.getElementById("upgrade-list");
  document.getElementById("upgrade-essence").textContent = meta.essence;

  // 레벨형 업그레이드 (공격력/연사속도/사거리/타워 슬롯) - 레벨 30까지 반복 구매
  levelContainer.innerHTML = "";
  for (const def of LEVELABLE_DEFS) {
    const level = meta.levels[def.key] || 0;
    const maxed = level >= def.maxLevel;
    const affordable = canBuyLevel(meta, def);
    const card = document.createElement("div");
    card.className = "upgrade-card" + (maxed ? " owned" : "");
    card.innerHTML = `
      <div class="upgrade-name">${def.name} <span class="upgrade-level">Lv. ${level} / ${def.maxLevel}</span></div>
      <div class="upgrade-desc">${def.desc(level)}</div>
      <div class="upgrade-footer">
        <span class="upgrade-cost">${maxed ? "최고 레벨" : levelCost(def, level) + " 정수"}</span>
        ${maxed ? "" : `<button class="buy-btn" ${affordable ? "" : "disabled"}>+1</button>`}
      </div>
    `;
    if (!maxed) {
      card.querySelector(".buy-btn").addEventListener("click", () => {
        if (!buyLevel(meta, def)) return;
        saveMeta(meta);
        buildUpgradeTree();
        refreshMenuEssence();
      });
    }
    levelContainer.appendChild(card);
  }

  // 1회성 업그레이드 (경제/성벽/타워 해금/정수 효율)
  container.innerHTML = "";
  for (const def of UPGRADE_DEFS) {
    const owned = meta.owned.includes(def.id);
    const lockedByRequire = def.requires && !meta.owned.includes(def.requires);
    const affordable = canBuy(meta, def);
    const card = document.createElement("div");
    card.className = "upgrade-card" + (owned ? " owned" : lockedByRequire ? " locked" : "");
    card.innerHTML = `
      <div class="upgrade-name">${def.name}</div>
      <div class="upgrade-desc">${def.desc}</div>
      <div class="upgrade-footer">
        <span class="upgrade-cost">${owned ? "보유함" : lockedByRequire ? "선행 업그레이드 필요" : def.cost + " 정수"}</span>
        ${owned ? "" : `<button class="buy-btn" ${affordable ? "" : "disabled"}>구매</button>`}
      </div>
    `;
    if (!owned && !lockedByRequire) {
      card.querySelector(".buy-btn").addEventListener("click", () => {
        if (!canBuy(meta, def)) return;
        meta.essence -= def.cost;
        meta.owned.push(def.id);
        saveMeta(meta);
        buildUpgradeTree();
        refreshMenuEssence();
      });
    }
    container.appendChild(card);
  }
}

// 캔버스 클릭 -> 타워 배치
document.getElementById("game-canvas").addEventListener("click", (e) => {
  if (!game || !game.selectedTowerType) return;
  const rect = e.target.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * e.target.width;
  const y = ((e.clientY - rect.top) / rect.height) * e.target.height;
  const placed = game.tryPlaceTower(x, y, game.selectedTowerType);
  if (placed) {
    document.querySelectorAll(".tower-btn").forEach((b) => b.classList.remove("selected"));
    game.selectedTowerType = null;
  }
});

document.getElementById("game-canvas").addEventListener("mousemove", (e) => {
  if (!game) return;
  const rect = e.target.getBoundingClientRect();
  game.hoverPoint = {
    x: ((e.clientX - rect.left) / rect.width) * e.target.width,
    y: ((e.clientY - rect.top) / rect.height) * e.target.height,
  };
});

document.getElementById("btn-speed").addEventListener("click", () => {
  if (!game) return;
  speedIndex = (speedIndex + 1) % SPEED_STEPS.length;
  applySpeedButton();
  game.setSpeed(SPEED_STEPS[speedIndex]);
});

document.getElementById("btn-start").addEventListener("click", startRun);
document.getElementById("btn-open-upgrades").addEventListener("click", () => {
  buildUpgradeTree();
  showScreen("upgrades");
});
document.getElementById("btn-upgrades-back").addEventListener("click", () => {
  refreshMenuEssence();
  showScreen("menu");
});
document.getElementById("btn-result-menu").addEventListener("click", () => {
  if (game) game.stop();
  refreshMenuEssence();
  showScreen("menu");
});
document.getElementById("btn-result-retry").addEventListener("click", startRun);

refreshMenuEssence();
showScreen("menu");
