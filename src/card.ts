import type { Result } from "./types";
import { pctOfTotal, rankFor } from "./scoring";
 
const COLORS = {
  ink: "#3A2C20",
  paper: "#FFFFFF",
  accent: "#A57548",       // copper — header dot + rank badge
  good: "#4E93A2",         // teal — header dot (brand mark)
  miss: "#D9624A",         // red — misses
  gold: "#EFB23E",         // hit star fill
  goldEdge: "#C8922A",     // hit star outline (definition on pale squares)
  faint: "rgba(58,44,32,.45)",
  line: "rgba(58,44,32,.16)",
};
 
export interface CardData {
  results: Result[];
  total: number;
  streak: number;
  date: string;
}
 
export async function drawCard(canvas: HTMLCanvasElement, d: CardData): Promise<void> {
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* fonts optional */
  }
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  const M = 88;
  const hits = d.results.filter((r) => r.hit).length;
  const rank = rankFor(pctOfTotal(d.total));
 
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.paper;
  roundRect(ctx, M - 28, M - 28, W - 2 * (M - 28), H - 2 * (M - 28), 44);
  ctx.fill();
 
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
 
  // header
  let dx = M;
  [COLORS.accent, COLORS.good, COLORS.miss].forEach((c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(dx + 10, M + 26, 10, 0, Math.PI * 2);
    ctx.fill();
    dx += 28;
  });
  ctx.fillStyle = COLORS.ink;
  ctx.font = '700 40px "Space Grotesk", sans-serif';
  ctx.fillText("Ballpark", dx + 8, M + 38);
  ctx.fillStyle = COLORS.faint;
  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText(d.date, W - M, M + 36);
  ctx.textAlign = "left";
 
  // score
  ctx.fillStyle = COLORS.faint;
  ctx.font = '500 28px "JetBrains Mono", monospace';
  ctx.fillText("SCORE", M, M + 175);
  ctx.fillStyle = COLORS.ink;
  ctx.font = '700 200px "Space Grotesk", sans-serif';
  ctx.fillText(String(d.total), M - 4, M + 380);
  const scoreW = ctx.measureText(String(d.total)).width;
  ctx.fillStyle = COLORS.faint;
  ctx.font = '600 64px "Space Grotesk", sans-serif';
  ctx.fillText("/ 500", M + scoreW + 16, M + 380);
 
  // rank badge
  ctx.font = '700 32px "JetBrains Mono", monospace';
  const rtext = rank.name.toUpperCase();
  const rw = ctx.measureText(rtext).width;
  ctx.fillStyle = COLORS.accent;
  roundRect(ctx, M, M + 425, rw + 52, 66, 16);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(rtext, M + 26, M + 469);
 
  // result squares (darker navy = tighter)
  const sqY = M + 565;
  const n = d.results.length;
  const gap = 20;
  const sqW = (W - 2 * M - gap * (n - 1)) / n;
  d.results.forEach((r, i) => {
    const x = M + i * (sqW + gap);
    const cx = x + sqW / 2;
    const cy = sqY + sqW / 2;
 
    if (r.hit) {
      const tight = Math.max(0, 1 - r.widthOOM / 3);
      ctx.fillStyle = `rgba(43,74,108,${0.3 + 0.7 * tight})`;   // navy, opacity grades tightness
      roundRect(ctx, x, sqY, sqW, sqW, 18);
      ctx.fill();
 
      // gold star
      drawStar(ctx, cx, cy, sqW * 0.26, sqW * 0.115);
      ctx.fillStyle = COLORS.gold;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.goldEdge;
      ctx.stroke();
    } else {
      ctx.fillStyle = COLORS.miss;
      roundRect(ctx, x, sqY, sqW, sqW, 18);
      ctx.fill();
 
      // miss cross
      ctx.fillStyle = "#fff";
      ctx.font = '700 52px "Space Grotesk", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("✕", cx, cy + 18);
      ctx.textAlign = "left";
    }
  });
  ctx.fillStyle = COLORS.faint;
  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.fillText("YOUR FIVE RANGES", M, sqY + sqW + 48);
 
  // stats
  const statY = sqY + sqW + 108;
  const colW = (W - 2 * M - 28) / 2;
  statBox(ctx, M, statY, colW, "HIT RATE", `${hits}/5`);
  statBox(ctx, M + colW + 28, statY, colW, "STREAK", `${d.streak}🔥`.replace("🔥", "d"));
 
  // footer
  ctx.fillStyle = COLORS.ink;
  ctx.font = '600 36px "Space Grotesk", sans-serif';
  ctx.fillText("How calibrated are you?", M, H - M - 70);
  ctx.fillStyle = COLORS.faint;
  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.fillText("Drag the range. Tighter is riskier.", M, H - M - 32);
 
  // domain (bottom-right, subtle link cue — mirrors the date top-right)
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.accent;
  ctx.font = '600 28px "JetBrains Mono", monospace';
  ctx.fillText("ballparktoday.com", W - M, H - M + 8);
  ctx.textAlign = "left";
}
 
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points = 5
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
 
function statBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, lab: string, val: string) {
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, 140, 18);
  ctx.stroke();
  ctx.fillStyle = COLORS.faint;
  ctx.font = '500 22px "JetBrains Mono", monospace';
  ctx.fillText(lab, x + 28, y + 44);
  ctx.fillStyle = COLORS.ink;
  ctx.font = '700 58px "Space Grotesk", sans-serif';
  ctx.fillText(val, x + 26, y + 108);
}
 
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
 
export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}
 
export async function copyCard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await cardBlob(canvas);
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}
 
export async function downloadCard(canvas: HTMLCanvasElement, total: number): Promise<void> {
  const blob = await cardBlob(canvas);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ballpark-${total}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}