# Orc Siege Incremental

[Sir, We Have an Orc Problem](https://store.steampowered.com/app/4594150) 스타일의
타워 디펜스 + 인크리멘탈 메타 진행 게임. 바닐라 HTML/CSS/JS, 별도 빌드 과정 없이
브라우저에서 바로 실행됩니다.

## 플레이 방법

`index.html`을 브라우저로 열거나, GitHub Pages로 배포해서 접속하세요.
(GitHub Pages: Settings → Pages → Branch: main → 저장하면 `https://tpwhd3141-cmyk.github.io/pract/`에서 접속 가능)

- **런(run)**: 15웨이브 동안 오크를 막아내면 승리. 기지 체력이 0이 되면 패배.
- 골드로 타워를 배치해 경로를 따라 걷는 오크를 처치합니다.
- 런이 끝나면(승리든 패배든) **정수(essence)**를 얻습니다.
- 정수로 업그레이드 트리에서 영구 강화(데미지, 사거리, 공격속도, 시작 골드,
  기지 체력, 신규 타워 해금 등)를 구매할 수 있습니다. 진행 상황은
  `localStorage`에 저장되어 브라우저를 닫아도 유지됩니다.

## 구조

```
index.html          화면 구조 (메뉴 / 게임 / 업그레이드 트리 / 결과)
css/style.css        스타일
js/path.js            경로(웨이포인트) 및 거리 계산
js/towers.js          타워 정의 + Tower 클래스
js/orcs.js             오크 타입 + Orc 클래스 + 웨이브 생성기
js/upgrades.js         메타 업그레이드 트리 정의 + localStorage 저장
js/game.js              핵심 게임 루프 (스폰, 전투, 렌더링)
js/main.js              화면 전환 및 DOM 이벤트 연결
```

## 타워

| 타워 | 코스트 | 특징 | 해금 |
|---|---|---|---|
| 기관총 | 50G | 빠르고 저렴 | 기본 보유 |
| 캐논 | 120G | 스플래시 데미지 | 업그레이드 트리 |
| 레이저 | 200G | 즉시 관통 데미지 | 업그레이드 트리(캐논 해금 후) |

## 확장 아이디어

- 액티브 스킬(공습, 오비탈 레이저, 핵) 추가
- 맵/경로 여러 종류 추가 및 선택 UI
- 오크 종류 추가(원거리 공격, 회복형 등)
- 사운드/이펙트
