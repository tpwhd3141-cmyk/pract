// 오크들이 따라 걷는 경로(웨이포인트). 캔버스 900x600 기준.
export const PATH = [
  { x: 480, y: -30 },
  { x: 480, y: 110 },
  { x: 140, y: 110 },
  { x: 140, y: 280 },
  { x: 760, y: 280 },
  { x: 760, y: 430 },
  { x: 480, y: 430 },
  { x: 480, y: 590 },
];

function computeSegments(path) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len, start: total });
    total += len;
  }
  return { segments, total };
}

const PATH_DATA = computeSegments(PATH);
export const PATH_LENGTH = PATH_DATA.total;

// 경로를 따라 dist 만큼 이동했을 때의 좌표
export function pointAtDistance(dist) {
  const { segments } = PATH_DATA;
  if (dist <= 0) return { ...segments[0].a };
  if (dist >= PATH_LENGTH) return { ...segments[segments.length - 1].b };
  for (const seg of segments) {
    if (dist >= seg.start && dist <= seg.start + seg.len) {
      const t = seg.len === 0 ? 0 : (dist - seg.start) / seg.len;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t,
      };
    }
  }
  return { ...segments[segments.length - 1].b };
}

// 임의의 점에서 경로까지의 최단 거리 (타워 배치 유효성 검사용)
export function distanceToPath(px, py) {
  let min = Infinity;
  for (const seg of PATH_DATA.segments) {
    const { a, b } = seg;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    const d = Math.hypot(px - cx, py - cy);
    if (d < min) min = d;
  }
  return min;
}
