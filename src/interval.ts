/**
 * The input: a log axis with two draggable handles plus a draggable band.
 * Fully isolated — it knows nothing about scoring or game state, so it can be
 * swapped for a different input later without touching anything else.
 */

export interface IntervalInput {
  getInterval(): { loVal: number; hiVal: number };
  setLow(loVal: number): void;
  setHigh(hiVal: number): void;
  onChange(cb: () => void): void;
  freeze(hit: boolean): void;
  showAnswer(value: number): void;
  destroy(): void;
}

interface Opts {
  minExp: number;
  maxExp: number;
}

export function mountInterval(container: HTMLElement, opts: Opts): IntervalInput {
  const { minExp, maxExp } = opts;
  const span = maxExp - minExp;
  let loPct = 36;
  let hiPct = 64;
  let frozen = false;
  let changeCb: (() => void) | null = null;

  container.innerHTML = "";
  container.classList.add("nline");

  const axis = el("div", "axis");
  const band = el("div", "band");
  const hLow = el("div", "handle");
  const hHigh = el("div", "handle");
  const dot = el("div", "answer-dot");
  dot.innerHTML = `<span class="cap"></span>`;
  container.append(axis, band, hLow, hHigh, dot);

  // decade ticks
  for (let e = minExp; e <= maxExp; e++) {
    const x = ((e - minExp) / span) * 100;
    const t = el("div", "tick");
    t.style.left = x + "%";
    const l = el("div", "ticklab");
    l.style.left = x + "%";
    l.textContent = shortNum(Math.pow(10, e));
    container.append(t, l);
  }

  const valAt = (pct: number) => Math.pow(10, minExp + (pct / 100) * span);
  const pctOf = (v: number) => ((Math.log10(v) - minExp) / span) * 100;

  function render() {
    hLow.style.left = loPct + "%";
    hHigh.style.left = hiPct + "%";
    band.style.left = loPct + "%";
    band.style.width = hiPct - loPct + "%";
    if (changeCb) changeCb();
  }

  // --- dragging ---
  let drag: { mode: "low" | "high" | "band"; startX: number; sLo: number; sHi: number } | null = null;
  const pctFromX = (clientX: number) => {
    const r = container.getBoundingClientRect();
    return clamp(((clientX - r.left) / r.width) * 100, 0, 100);
  };
  const start = (e: PointerEvent, mode: "low" | "high" | "band") => {
    if (frozen) return;
    e.preventDefault();
    e.stopPropagation();
    drag = { mode, startX: e.clientX, sLo: loPct, sHi: hiPct };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const p = pctFromX(e.clientX);
    if (drag.mode === "low") loPct = Math.min(p, hiPct);
    else if (drag.mode === "high") hiPct = Math.max(p, loPct);
    else {
      const r = container.getBoundingClientRect();
      const d = ((e.clientX - drag.startX) / r.width) * 100;
      const w = drag.sHi - drag.sLo;
      let nl = drag.sLo + d;
      let nh = drag.sHi + d;
      if (nl < 0) { nl = 0; nh = w; }
      if (nh > 100) { nh = 100; nl = 100 - w; }
      loPct = nl;
      hiPct = nh;
    }
    render();
  };
  const up = () => {
    drag = null;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  hLow.addEventListener("pointerdown", (e) => start(e, "low"));
  hHigh.addEventListener("pointerdown", (e) => start(e, "high"));
  band.addEventListener("pointerdown", (e) => start(e, "band"));

  render();

  return {
    getInterval: () => ({ loVal: valAt(loPct), hiVal: valAt(hiPct) }),
    // Typed-input setters — mirror the drag clamping: low can't pass high,
    // high can't pass low. Both re-render, firing onChange just like a drag.
    setLow(loVal) {
      if (frozen) return;
      loPct = Math.min(clamp(pctOf(loVal), 0, 100), hiPct);
      render();
    },
    setHigh(hiVal) {
      if (frozen) return;
      hiPct = Math.max(clamp(pctOf(hiVal), 0, 100), loPct);
      render();
    },
    onChange(cb) {
      changeCb = cb;
      cb();
    },
    freeze(hit) {
      frozen = true;
      band.classList.add(hit ? "hit" : "miss");
      hLow.classList.add("frozen");
      hHigh.classList.add("frozen");
    },
    showAnswer(value) {
      const x = clamp(pctOf(value), 0, 100);
      dot.style.left = x + "%";
      dot.classList.add("show");
      (dot.querySelector(".cap") as HTMLElement).textContent = "answer";
    },
    destroy() {
      up();
      container.innerHTML = "";
      container.classList.remove("nline");
    },
  };
}

function el(tag: string, cls: string): HTMLElement {
  const n = document.createElement(tag);
  n.className = cls;
  return n;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function shortNum(n: number): string {
  if (n >= 1e9) return n / 1e9 + "B";
  if (n >= 1e6) return n / 1e6 + "M";
  if (n >= 1e3) return n / 1e3 + "k";
  return String(Math.round(n));
}