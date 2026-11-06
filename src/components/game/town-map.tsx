"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon, MapIcon } from "@/components/icons";
import { Sheet } from "@/components/game/story-panel";
import { placesOf, type MapPlace } from "@/components/game/places";
import type { Senses } from "@/components/land/engine";
import { JUNGLE, jungleOf } from "@/components/land/jungle";
import { BX, BZ, PX, PZ, TOWN_HALF, TOWN_RINGS, isCivic, isPark, isPlaza, lotForPlot, townCenter } from "@/components/land/layout";
import { site } from "@/lib/site";
import { townOf } from "@/lib/world";
import { patchGame, toast, useGame, type Dest } from "@/lib/game";
import { sfx } from "@/lib/sound";

export type MapHouse = { plot: number; x: number; z: number; w: number; d: number; rot: number; done: boolean; mine: boolean };
export type MapApi = {
  senses: () => Senses | null;
  houses: () => MapHouse[];
  flyTo: (x: number, z: number, facing: number | null) => void;
};

const fmt = (n: number) => n.toLocaleString("en");

// ---------- drawing ----------

type Frame = { cx: number; cz: number; scale: number; fx: number; fz: number; w: number; h: number };

const toScreen = (f: Frame, x: number, z: number): [number, number] => {
  const vx = x - f.cx;
  const vz = z - f.cz;
  // Right of the camera's forward goes right on the map, forward goes up.
  return [(vx * -f.fz + vz * f.fx) * f.scale + f.w / 2, -(vx * f.fx + vz * f.fz) * f.scale + f.h / 2];
};

const poly = (g: CanvasRenderingContext2D, f: Frame, pts: [number, number][]) => {
  g.beginPath();
  pts.forEach(([x, z], k) => {
    const [sx, sy] = toScreen(f, x, z);
    if (k) g.lineTo(sx, sy);
    else g.moveTo(sx, sy);
  });
  g.closePath();
};

const rect = (g: CanvasRenderingContext2D, f: Frame, x: number, z: number, hx: number, hz: number, rot = 0) => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pts: [number, number][] = [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ].map(([a, b]) => [x + a * c + b * s, z - a * s + b * c]);
  poly(g, f, pts);
};

const ellipse = (g: CanvasRenderingContext2D, f: Frame, x: number, z: number, rx: number, rz: number) => {
  const pts: [number, number][] = [];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    pts.push([x + Math.cos(a) * rx, z + Math.sin(a) * rz]);
  }
  poly(g, f, pts);
};

const pill = (g: CanvasRenderingContext2D, x: number, y: number, text: string, bg: string, size: number) => {
  g.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
  const w = g.measureText(text).width + size * 0.9;
  const h = size * 1.55;
  const r = h / 2;
  g.beginPath();
  g.moveTo(x - w / 2 + r, y - h / 2);
  g.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
  g.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
  g.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
  g.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
  g.closePath();
  g.fillStyle = bg;
  g.shadowColor = "rgba(0,0,0,0.25)";
  g.shadowBlur = 4;
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "#FFFFFF";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x, y + 0.5);
};

type DrawOpts = {
  town: number;
  houses: MapHouse[];
  places: MapPlace[];
  you: Senses | null;
  dest: Dest | null;
  labels: boolean;
  dpr: number;
};

const draw = (g: CanvasRenderingContext2D, f: Frame, o: DrawOpts) => {
  const [ox, oz] = townCenter(o.town);
  const px = (n: number) => n * o.dpr;
  g.clearRect(0, 0, f.w, f.h);
  g.fillStyle = "#B7DA98";
  g.fillRect(0, 0, f.w, f.h);
  // The jungle: its trail and the clearing with the waterhole.
  const j = jungleOf(o.town);
  g.fillStyle = "#8CC56E";
  ellipse(g, f, j.cx, j.cz, JUNGLE.r + 30, JUNGLE.r + 30);
  g.fill();
  g.fillStyle = "#A9D884";
  ellipse(g, f, j.cx, j.cz, JUNGLE.r, JUNGLE.r);
  g.fill();
  g.fillStyle = "#79C6EA";
  ellipse(g, f, j.cx, j.cz, JUNGLE.pond.rx, JUNGLE.pond.rz);
  g.fill();
  g.fillStyle = "#D9C9A3";
  rect(g, f, (j.x0 + j.cx - JUNGLE.r) / 2, j.tz, (j.cx - JUNGLE.r - j.x0) / 2 + 2, JUNGLE.half);
  g.fill();
  // The town: streets, then the blocks.
  g.fillStyle = "#D3D6DB";
  rect(g, f, ox, oz, TOWN_HALF.x, TOWN_HALF.z);
  g.fill();
  const R = TOWN_RINGS;
  for (let i = -R; i <= R; i++)
    for (let jj = -R; jj <= R; jj++) {
      const cx = ox + i * PX;
      const cz = oz + jj * PZ;
      g.fillStyle = "#F2EDE3";
      rect(g, f, cx, cz, BX / 2, BZ / 2);
      g.fill();
      g.fillStyle = isPlaza(i, jj) ? "#EADBC0" : isCivic(i, jj) ? "#D3E7BF" : isPark(i, jj) ? "#A3D684" : "#CBE6B3";
      rect(g, f, cx, cz, BX / 2 - 1.6, BZ / 2 - 1.6);
      g.fill();
      if (isPlaza(i, jj)) {
        g.fillStyle = "#79C6EA";
        ellipse(g, f, cx, cz, 4.4, 4.4);
        g.fill();
      } else if (isPark(i, jj) && !isCivic(i, jj)) {
        g.fillStyle = "#79C6EA";
        ellipse(g, f, cx, cz, 7, 4.5);
        g.fill();
      }
    }
  // Houses: finished, being built, and yours.
  for (const h of o.houses) {
    g.fillStyle = h.mine ? "#E5484D" : h.done ? "#E39A6A" : "#C7B9A2";
    rect(g, f, h.x, h.z, h.w / 2 + 0.3, h.d / 2 + 0.3, h.rot);
    g.fill();
    if (h.mine) {
      g.lineWidth = px(1.5);
      g.strokeStyle = "#FFFFFF";
      g.stroke();
    }
  }
  // The places.
  for (const p of o.places) {
    if (p.key === "jungle") continue;
    g.fillStyle = p.color;
    rect(g, f, p.x, p.z, p.hx, p.hz);
    g.fill();
  }
  if (o.labels) {
    for (const p of o.places) {
      const [sx, sy] = toScreen(f, p.x, p.z);
      const x = Math.max(px(40), Math.min(f.w - px(40), sx));
      pill(g, x, sy + p.dy * px(11) - (p.dy ? 0 : px(2)), p.short, p.color, px(10.5));
    }
    const mine = o.houses.find((h) => h.mine);
    if (mine) {
      const [sx, sy] = toScreen(f, mine.x, mine.z);
      pill(g, sx, sy - px(14), "You", "#18181B", px(10));
    }
  }
  // Where you're heading.
  const you = o.you;
  const yx = you?.player?.x ?? you?.x;
  const yz = you?.player?.z ?? you?.z;
  if (o.dest) {
    const [dx, dy] = toScreen(f, o.dest.x, o.dest.z);
    if (yx !== undefined && yz !== undefined) {
      const [ax, ay] = toScreen(f, yx, yz);
      g.setLineDash([px(4), px(4)]);
      g.lineWidth = px(2.5);
      g.strokeStyle = "#18181B";
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(dx, dy);
      g.stroke();
      g.setLineDash([]);
    }
    g.lineWidth = px(3);
    g.strokeStyle = o.dest.color;
    g.beginPath();
    g.arc(dx, dy, px(8), 0, Math.PI * 2);
    g.stroke();
  }
  // You: an arrow for your person (play mode), or a ring where the camera looks.
  if (you && yx !== undefined && yz !== undefined) {
    const [sx, sy] = toScreen(f, yx, yz);
    if (you.player) {
      const ry = you.player.ry;
      const dx = Math.sin(ry);
      const dz = Math.cos(ry);
      const ux = dx * -f.fz + dz * f.fx;
      const uy = -(dx * f.fx + dz * f.fz);
      const a = Math.atan2(uy, ux);
      const s = px(8);
      g.beginPath();
      g.moveTo(sx + Math.cos(a) * s * 1.3, sy + Math.sin(a) * s * 1.3);
      g.lineTo(sx + Math.cos(a + 2.4) * s, sy + Math.sin(a + 2.4) * s);
      g.lineTo(sx + Math.cos(a + Math.PI) * s * 0.35, sy + Math.sin(a + Math.PI) * s * 0.35);
      g.lineTo(sx + Math.cos(a - 2.4) * s, sy + Math.sin(a - 2.4) * s);
      g.closePath();
      g.fillStyle = "#E5484D";
      g.strokeStyle = "#FFFFFF";
      g.lineWidth = px(2);
      g.fill();
      g.stroke();
    } else {
      g.beginPath();
      g.arc(sx, sy, px(9), 0, Math.PI * 2);
      g.fillStyle = "rgba(24,24,27,0.18)";
      g.fill();
      g.lineWidth = px(2);
      g.strokeStyle = "#18181B";
      g.stroke();
    }
  }
};

// A frame showing the whole town, north up, fitted to w x h.
const townFrame = (town: number, w: number, h: number): Frame => {
  const [ox, oz] = townCenter(town);
  const scale = Math.min(w / (2 * TOWN_HALF.x + 16), h / (2 * TOWN_HALF.z + 16));
  return { cx: ox, cz: oz, scale, fx: 0, fz: -1, w, h };
};

const fromScreen = (f: Frame, sx: number, sy: number): [number, number] => {
  const a = (sx - f.w / 2) / f.scale;
  const b = -(sy - f.h / 2) / f.scale;
  // Inverse of toScreen: a = v . right, b = v . forward.
  return [f.cx + a * -f.fz + b * f.fx, f.cz + a * f.fx + b * f.fz];
};

// ---------- the full map ----------

export function TownMap({ api }: { api: MapApi }) {
  const { mapOpen, play, dest } = useGame();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<Frame | null>(null);
  const [you, setYou] = useState<Senses | null>(null);
  const [width, setWidth] = useState(0);

  // Keep up with where you are while it's open.
  useEffect(() => {
    if (!mapOpen) return;
    setYou(api.senses());
    const id = window.setInterval(() => setYou(api.senses()), 400);
    return () => window.clearInterval(id);
  }, [mapOpen, api]);

  useEffect(() => {
    if (!mapOpen) return;
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [mapOpen]);

  const town = you?.town || 1;
  const places = placesOf(town);
  const height = Math.round(width * ((2 * TOWN_HALF.z + 16) / (2 * TOWN_HALF.x + 16)));

  useEffect(() => {
    const cv = canvas.current;
    if (!mapOpen || !cv || !width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    const g = cv.getContext("2d");
    if (!g) return;
    const f = townFrame(town, cv.width, cv.height);
    frame.current = f;
    draw(g, f, { town, houses: api.houses(), places, you, dest, labels: true, dpr });
  }, [mapOpen, width, height, town, places, you, dest, api]);

  const close = useCallback(() => patchGame({ mapOpen: false }), []);

  if (!mapOpen) return null;

  const mine = you?.myPlot && townOf(you.myPlot) === town ? lotForPlot(you.myPlot) : null;
  const here = you ? { x: you.player?.x ?? you.x, z: you.player?.z ?? you.z } : null;
  const dist = (x: number, z: number) => (here ? Math.round(Math.hypot(x - here.x, z - here.z)) : null);

  const go = (key: string, name: string, x: number, z: number, facing: number | null, color: string) => {
    if (play) {
      patchGame({ dest: { key, name, x, z, color }, mapOpen: false });
      toast(`Heading for ${name}. Follow the dotted line on your map.`, "info", true);
      sfx("pop");
    } else {
      close();
      api.flyTo(x, z, facing);
    }
  };

  const tap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const f = frame.current;
    const cv = canvas.current;
    if (!f || !cv) return;
    const r = cv.getBoundingClientRect();
    const k = cv.width / r.width;
    const sx = (e.clientX - r.left) * k;
    const sy = (e.clientY - r.top) * k;
    let best: MapPlace | null = null;
    let bd = 26 * k;
    for (const p of places) {
      const [px, py] = toScreen(f, p.x, p.z);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) return go(best.key, best.name, best.x, best.z, best.facing, best.color);
    if (mine) {
      const [px, py] = toScreen(f, mine.x, mine.z);
      if (Math.hypot(px - sx, py - sy) < 22 * k) return go("home", "your house", mine.x, mine.z, mine.rot, "#E5484D");
    }
    // Anywhere else in town: look there (not while playing).
    if (!play) {
      const [x, z] = fromScreen(f, sx, sy);
      close();
      api.flyTo(x, z, null);
    }
  };

  const rows: { key: string; name: string; color: string; x: number; z: number; facing: number | null }[] = [
    ...(mine ? [{ key: "home", name: "Your house", color: "#E5484D", x: mine.x, z: mine.z, facing: mine.rot }] : []),
    ...places.map((p) => ({ key: p.key, name: p.name, color: p.color, x: p.x, z: p.z, facing: p.facing })),
  ];

  return (
    <Sheet onClose={close} label="Town map">
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-900 text-white">
            <MapIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-zinc-950">{site.townName(town)} map</p>
            <p className="text-xs text-zinc-500">
              {play ? "Tap a place to walk there: a dotted line on your map shows the way." : "Tap a place, or anywhere in town, to go and look."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <CloseIcon className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div ref={wrap} className="w-full">
          <canvas
            ref={canvas}
            onClick={tap}
            style={{ width: "100%", height }}
            className="block cursor-pointer rounded-2xl ring-1 ring-zinc-200"
            aria-label={`Map of ${site.townName(town)}`}
          />
        </div>
        <ul className="mt-3 flex flex-col">
          {rows.map((r) => {
            const d = dist(r.x, r.z);
            const heading = dest?.key === r.key;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => go(r.key, r.name === "Your house" ? "your house" : r.name, r.x, r.z, r.facing, r.color)}
                  className="flex w-full items-center gap-3 border-b border-zinc-100 py-2.5 text-left last:border-0 hover:bg-zinc-50"
                >
                  <span className="size-3 shrink-0 rounded-[4px]" style={{ background: r.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{r.name}</span>
                  {d !== null && <span className="shrink-0 font-mono text-xs text-zinc-500">{fmt(d)} m</span>}
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${heading ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-800"}`}>
                    {heading ? "Heading there" : play ? "Go" : "Show"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

// ---------- the mini-map (play mode) ----------

const MINI_R = 95; // metres from your person to the edge

// Your surroundings, turned so the way the camera looks is up. Tap it for the full map.
export function MiniMap({ api }: { api: MapApi }) {
  const { dest } = useGame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const destRef = useRef(dest);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    destRef.current = dest;
  }, [dest]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let houses: MapHouse[] = [];
    let housesAt = 0;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (now - last < 66) return;
      last = now;
      const cv = canvas.current;
      const s = api.senses();
      if (!cv || !s || !s.player) return;
      const size = cv.clientWidth;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(size * dpr)) {
        cv.width = Math.round(size * dpr);
        cv.height = Math.round(size * dpr);
      }
      const g = cv.getContext("2d");
      if (!g) return;
      if (now - housesAt > 3000) {
        houses = api.houses();
        housesAt = now;
      }
      const W = cv.width;
      const f: Frame = { cx: s.player.x, cz: s.player.z, scale: W / 2 / MINI_R, fx: s.fx, fz: s.fz, w: W, h: W };
      g.save();
      g.beginPath();
      g.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
      g.clip();
      const places = placesOf(s.town);
      const d = destRef.current;
      draw(g, f, { town: s.town, houses, places, you: s, dest: d, labels: false, dpr });
      // Places off the edge: a dot on the rim in their colour.
      const rim = W / 2 - 5 * dpr;
      for (const p of places) {
        const [sx, sy] = toScreen(f, p.x, p.z);
        const dx = sx - W / 2;
        const dy = sy - W / 2;
        const len = Math.hypot(dx, dy);
        if (len <= rim) continue;
        g.beginPath();
        g.arc(W / 2 + (dx / len) * rim, W / 2 + (dy / len) * rim, (d?.key === p.key ? 5 : 3.2) * dpr, 0, Math.PI * 2);
        g.fillStyle = p.color;
        g.fill();
      }
      g.restore();
      g.lineWidth = 3 * dpr;
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.arc(W / 2, W / 2, W / 2 - 1.5 * dpr, 0, Math.PI * 2);
      g.stroke();
      // Arrived?
      if (d) {
        const m = Math.hypot(d.x - s.player.x, d.z - s.player.z);
        setLeft(Math.round(m));
        if (m < 14) {
          patchGame({ dest: null });
          setLeft(null);
          toast(`You're at ${d.name === "your house" ? "your house" : `the ${d.name}`}.`, "good");
        }
      } else setLeft(null);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [api]);

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={() => patchGame({ mapOpen: true })}
        aria-label="Town map"
        title="Town map"
        className="block size-[7.25rem] overflow-hidden rounded-full shadow-[0_10px_26px_-12px_rgba(0,0,0,0.7)] transition-transform active:scale-[0.97] md:size-[10.5rem] phone-land:size-[6.5rem]"
      >
        <canvas ref={canvas} className="block size-full" />
      </button>
      {dest && left !== null && (
        <p className="max-w-[46vw] truncate rounded-full bg-zinc-950/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: dest.color }} />
          {dest.name === "your house" ? "Home" : dest.name} · {fmt(left)} m
        </p>
      )}
    </div>
  );
}
