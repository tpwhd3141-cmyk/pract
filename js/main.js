import { Game, TOTAL_WAVES } from "./game.js";
import { TOWER_DEFS } from "./towers.js";
import { UPGRADE_DEFS, loadMeta, saveMeta, computeMods, canBuy } from "./upgrades.js";

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

function refreshMenuEssence() {
  document.getElementById("menu-essence").textContent = meta.essence;
}

function startRun() {
  const mods = computeMods(meta);
  const canvas = document.getElementById("game-canvas");
  game = new Game(canvas, mods);
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
    btn.disabled = !unlocked;
    btn.innerHTML = unlocked
      ? `<span class="tw-name">${def.name}</span><span class="tw-cost">${def.cost}G</span>`
      : `<span class="tw-name">🔒 ${def.name}</span><span class="tw-cost">업그레이드 필요</span>`;
    btn.title = def.desc;
    btn.addEventListener("click", () => {
      if (!unlocked) return;
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
}

function onGameUpdate(g) {
  document.getElementById("hud-gold").textContent = Math.floor(g.gold);
  document.getElementById("hud-hp").textContent = `${Math.ceil(g.baseHp)} / ${g.maxBaseHp}`;
  document.getElementById("hud-wave").textContent = `${g.wave} / ${TOTAL_WAVES}`;
  document.getElementById("hud-status").textContent = g.waveActive
    ? "웨이브 진행 중"
    : g.wave >= TOTAL_WAVES
    ? "승리!"
    : `다음 웨이브까지 ${Math.max(0, g.waveCooldown).toFixed(1)}s`;
}

function onGameEnd({ victory, wavesCleared, orcsKilled }) {
  const base = Math.floor(orcsKilled / 5) + wavesCleared * 3 + (victory ? 20 : 0);
  const earned = Math.round(base * (1 + computeMods(meta).essenceMult));
  meta.essence += earned;
  saveMeta(meta);

  document.getElementById("result-title").textContent = victory ? "승리! 오크의 침공을 막아냈습니다" : "기지가 함락되었습니다";
  document.getElementById("result-title").className = victory ? "win" : "lose";
  document.getElementById("result-waves").textContent = `${wavesCleared} / ${TOTAL_WAVES}`;
  document.getElementById("result-kills").textContent = orcsKilled;
  document.getElementById("result-essence").textContent = `+${earned}`;
  showScreen("result");
}

function buildUpgradeTree() {
  const container = document.getElementById("upgrade-list");
  container.innerHTML = "";
  document.getElementById("upgrade-essence").textContent = meta.essence;
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
