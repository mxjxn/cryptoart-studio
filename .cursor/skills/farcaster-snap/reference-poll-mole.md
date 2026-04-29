# Example: Farcaster Snap poll — favorite mole variety

Use this when building a **single-choice poll** with **server-side tallies** and a **results** view. Adapt names and keys; wire the handler to your template’s `SnapFunction` and `registerSnapHandler()` exactly as in the [snap template](https://github.com/farcasterxyz/snap/tree/main/template).

## Constraints

- `bar_chart` supports **1–6 items** — keep **≤ 6 options** (this example uses six mole varieties).
- Short labels fit [snap string limits](https://docs.farcaster.xyz/snap/constraints) better than long names.
- One **primary** button per surface; here the first option uses `primary`, others `secondary` (adjust to taste).

## Options (example)

```ts
export const MOLE_POLL_OPTIONS = [
  { id: "negro", label: "Mole negro (Oaxaca)" },
  { id: "coloradito", label: "Mole coloradito" },
  { id: "amarillo", label: "Mole amarillo" },
  { id: "verde", label: "Mole verde" },
  { id: "poblano", label: "Mole poblano" },
  { id: "pipian", label: "Pipián / guacamole" },
] as const;
```

## Storage shape

Store a single JSON blob, e.g. key `"mole_votes"`, as `Record<string, number>` (vote id → count). Initialize counts to `0` for each `id`. On each `submit` with `params.choice`, increment that key (and optionally record `fid` once per user if you add de-duplication logic later — not shown here).

## Interaction model

1. **GET / first open:** Show title, short description, and one **button per option**. Each button’s `on.press` uses `action: "submit"` and `params: { choice: "<id>" }` (exact key names must match what your server reads from the snap context — follow the template’s `inputs` / action payload shape).
2. **After submit:** Persist tallies, then return a new UI with a **`bar_chart`** of the six options (sorted by count descending if you like) plus `text` for “Thanks — here’s how everyone voted.”

## UI sketch (`ui.elements`)

Map element names to a flat object; set `ui.root` to your top-level stack id.

- `title`: `text`, bold, “Favorite mole?”
- `subtitle`: `text`, sm, “Tap one — results update live.”
- `opts`: vertical stack of `button` children, **or** one `button` per row in a `vstack` list
- After vote: `results_title` + `chart` (`type: "bar_chart"`) with `props.items` array of `{ label, value }` derived from tallies (normalize values 0–100 for display if the template expects percentages, per official `bar_chart` docs)

## Deploy reminder

Use **`framework`: `hono`**, set **`SNAP_PUBLIC_BASE_URL`** to `https://<projectName>.host.neynar.app`, and follow **host.neynar.app** `SKILL.md` from `curl -fsSL https://host.neynar.app/SKILL.md` for packaging and API keys.

## Casting the snap

After deploy, **cast the live snap URL** on Farcaster so the interactive embed appears in-feed (see main `SKILL.md` Step 7).
