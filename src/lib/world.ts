// The world is an endless set of towns. Each town has TOWN_SIZE plots, and house numbers run on
// across towns in join order: houses 1-1,000 are Town 1, 1,001-2,000 are Town 2, and so on.
// TOWN_SIZE must match the 1000 in supabase/schema.sql. Never change it once people have joined.
export const TOWN_SIZE = 1000;

export const townOf = (plot: number) => Math.floor((Math.max(1, plot) - 1) / TOWN_SIZE) + 1;
export const plotInTown = (plot: number) => ((Math.max(1, plot) - 1) % TOWN_SIZE) + 1;
export const firstPlotOf = (town: number) => (town - 1) * TOWN_SIZE + 1;

// One house on the map. start / done: when building started and when it finishes (Unix seconds,
// from the database: 30 days after joining, 2 days sooner per invited friend, 3 days at the least).
// The rest is the person who lives there (src/components/people/look.ts): their look number, age,
// personality, job (null: waiting for one), income in coins a day, and whether their owner is in
// the game right now.
export type House = {
  plot: number;
  username: string;
  start: number;
  done: number;
  waves: number;
  look: number;
  age: number;
  trait: string;
  job: string | null;
  income: number;
  online: boolean;
};

export type MyHouse = House & {
  createdAt: string;
  invites: number; // friends who joined with this house's invite link
  unread: number; // unread messages from neighbours
};

// What public.waitlist_world() returns: the whole world in numbers, plus one town's houses.
export type WorldView = {
  houses: number; // people on the waitlist
  last: number; // highest house number given out
  next: number; // lowest free house number: what you get if you don't pick a plot
  open: number; // highest town you can pick a plot in (towns open one at a time, in order)
  towns: [number, number][]; // [town, houses] for towns that have houses
  town: number; // the town `plots` belongs to
  plots: House[]; // that town's houses, in house order
  me: MyHouse | null; // the signed-in visitor's own house
};

export const emptyWorld: WorldView = { houses: 0, last: 0, next: 1, open: 1, towns: [], town: 1, plots: [], me: null };

export const nextPlot = (view: Pick<WorldView, "next">) => view.next;

// Can someone pick this house number? (Whether it's free is checked against the town's houses.)
export const isOpenPlot = (view: Pick<WorldView, "open">, plot: number) =>
  Number.isInteger(plot) && plot >= 1 && plot <= view.open * TOWN_SIZE;

export const housesInTown = (view: Pick<WorldView, "towns">, town: number) =>
  view.towns.find(([t]) => t === town)?.[1] ?? 0;

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const int = (v: unknown) => (isInt(v) ? v : 0);

// Checks the JSON from the database, so a bad response can't break the page.
export const parseWorldView = (data: unknown): WorldView | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (
    !isInt(d.houses) ||
    !isInt(d.last) ||
    !isInt(d.next) ||
    !isInt(d.open) ||
    !isInt(d.town) ||
    !Array.isArray(d.towns) ||
    !Array.isArray(d.plots)
  )
    return null;

  const towns: [number, number][] = [];
  for (const t of d.towns) if (Array.isArray(t) && isInt(t[0]) && isInt(t[1])) towns.push([t[0], t[1]]);

  const plots: House[] = [];
  for (const p of d.plots) {
    if (!Array.isArray(p) || !isInt(p[0]) || typeof p[1] !== "string") continue;
    plots.push({
      plot: p[0],
      username: p[1],
      start: int(p[2]),
      done: int(p[3]),
      waves: int(p[4]),
      // Older databases don't send the person yet; the map then works their look out itself.
      look: isInt(p[5]) && p[5] >= 0 ? p[5] : -1,
      age: int(p[6]),
      trait: typeof p[7] === "string" ? p[7] : "",
      job: typeof p[8] === "string" && p[8] ? p[8] : null,
      income: int(p[9]),
      online: p[10] === true,
    });
  }

  let me: MyHouse | null = null;
  if (d.me && typeof d.me === "object") {
    const m = d.me as Record<string, unknown>;
    if (isInt(m.plot) && typeof m.username === "string" && typeof m.createdAt === "string") {
      // Your own person is in `plots` (your town is the one sent) when the database knows them.
      const own = plots.find((p) => p.plot === m.plot);
      me = {
        plot: m.plot,
        username: m.username,
        createdAt: m.createdAt,
        start: int(m.start),
        done: int(m.done),
        waves: int(m.waves),
        invites: int(m.invites),
        unread: int(m.unread),
        look: own?.look ?? -1,
        age: own?.age ?? 0,
        trait: own?.trait ?? "",
        job: own?.job ?? null,
        income: own?.income ?? 0,
        online: true,
      };
    }
  }

  return { houses: d.houses, last: d.last, next: d.next, open: d.open, towns, town: d.town, plots, me };
};
