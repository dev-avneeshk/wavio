// The world is an endless set of towns. Each town has TOWN_SIZE plots, and house numbers run on
// across towns in join order: houses 1-1,000 are Town 1, 1,001-2,000 are Town 2, and so on.
// TOWN_SIZE must match the 1000 in supabase/schema.sql. Never change it once people have joined.
export const TOWN_SIZE = 1000;

export const townOf = (plot: number) => Math.floor((Math.max(1, plot) - 1) / TOWN_SIZE) + 1;
export const plotInTown = (plot: number) => ((Math.max(1, plot) - 1) % TOWN_SIZE) + 1;
export const firstPlotOf = (town: number) => (town - 1) * TOWN_SIZE + 1;

export type MyHouse = { plot: number; username: string; createdAt: string };

// What public.waitlist_world() returns: the whole world in numbers, plus one town's houses.
export type WorldView = {
  houses: number; // people on the waitlist
  last: number; // highest house number given out; the next person gets last + 1
  towns: [number, number][]; // [town, houses] for towns that have houses
  town: number; // the town `plots` belongs to
  plots: [number, string][]; // [house number, Instagram username], in house order
  me: MyHouse | null; // the signed-in visitor's own house
};

export const emptyWorld: WorldView = { houses: 0, last: 0, towns: [], town: 1, plots: [], me: null };

export const nextPlot = (view: Pick<WorldView, "last">) => view.last + 1;

export const housesInTown = (view: Pick<WorldView, "towns">, town: number) =>
  view.towns.find(([t]) => t === town)?.[1] ?? 0;

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

// Checks the JSON from the database, so a bad response can't break the page.
export const parseWorldView = (data: unknown): WorldView | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (!isInt(d.houses) || !isInt(d.last) || !isInt(d.town) || !Array.isArray(d.towns) || !Array.isArray(d.plots)) return null;

  const towns: [number, number][] = [];
  for (const t of d.towns) if (Array.isArray(t) && isInt(t[0]) && isInt(t[1])) towns.push([t[0], t[1]]);

  const plots: [number, string][] = [];
  for (const p of d.plots) if (Array.isArray(p) && isInt(p[0]) && typeof p[1] === "string") plots.push([p[0], p[1]]);

  let me: MyHouse | null = null;
  if (d.me && typeof d.me === "object") {
    const m = d.me as Record<string, unknown>;
    if (isInt(m.plot) && typeof m.username === "string" && typeof m.createdAt === "string") {
      me = { plot: m.plot, username: m.username, createdAt: m.createdAt };
    }
  }

  return { houses: d.houses, last: d.last, towns, town: d.town, plots, me };
};
