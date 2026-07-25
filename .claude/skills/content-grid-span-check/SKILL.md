---
name: content-grid-span-check
description: Use whenever adding, moving, or editing a component rendered inside `<div className="content-grid">` on any page in this dashboard (Race.tsx, Today.tsx, Plan.tsx, Injury.tsx, etc.), or whenever a user reports a panel/widget that looks squeezed into a narrow column, or renders with a huge empty gap next to it. This bug pattern has recurred 3+ times in this codebase.
---

# `.content-grid` span bug — recurring pattern in this dashboard

## The rule

`.content-grid` (defined in `src/styles.css`) is a **12-column CSS grid**:
`grid-template-columns: repeat(12, minmax(0, 1fr))`.

**Every direct child of `.content-grid` must carry a `span-N` class** (`span-12`,
`span-7`, `span-6`, `span-5`, ...) or it defaults to spanning a single implicit
column — rendering as a narrow ~1/12-width sliver with a large empty gap next
to it. Spans in one row should sum to 12 (or less, wrapping fine) — check
`src/styles.css` for the exact `.span-*` rules.

The reverse mistake also happens: a `span-*` class applied to something that
is **not** a direct child of `.content-grid` (e.g. sitting in `.page-stack`,
a single-column grid) corrupts the *parent's* implicit grid instead — the
parent auto-generates 12 columns to satisfy the span, and *every sibling*
collapses into a narrow column too. This has bitten `RaceResultCard`'s
"สรุปผลแข่ง" panel before (fixed by removing the stray `span-12`).

## Where this breaks, concretely

1. **Component returns a Panel directly** (`<Panel className="span-12">...`)
   as its root — fine, as long as the component itself is placed straight
   inside `.content-grid`.

2. **Component returns a wrapper div around one or more Panels**, e.g.:
   ```tsx
   export function Widget() {
     return (
       <div style={{ display: "grid", gap: 18 }}>  {/* <-- missing className="span-12" */}
         <Panel className="span-12">...</Panel>
         <Panel className="span-12">...</Panel>
       </div>
     );
   }
   ```
   The `span-12` on the *inner* Panels is meaningless — their real parent is
   the wrapper `div`, which is its own single-column grid. The **wrapper**
   is the actual child of `.content-grid` and needs the `span-12`, not the
   Panels inside it. This exact bug hit `RaceEngine.tsx`'s root div and
   squeezed the whole "Interactive Race Pacing & Cutoff Safety Engine"
   widget into a ~250px sliver on both desktop and mobile.

3. **A Panel placed outside `.content-grid`** (directly in `.page-stack` or
   similar single-column container) still carrying a leftover `span-12`
   class — harmless on its own, but if a *sibling* also has one it corrupts
   `.page-stack`'s layout for every child. Remove `span-*` classes from
   anything not a direct `.content-grid` child.

## How to check when adding/editing a widget

1. Find every place the new/edited component is rendered. Is its call site
   a direct child of `<div className="content-grid">`?
2. If yes: does the component's **root returned JSX element** carry a
   `span-N` class? (Not a Panel nested two levels deep inside a wrapper —
   the literal outermost element.)
3. If the component returns a `<>fragment</>` or wrapper `<div>` containing
   multiple Panels, the wrapper itself needs the `span-N`, and the inner
   Panels' own `span-*` (if any) should be removed or is a no-op.
4. If the call site is **not** inside `.content-grid` (e.g. `.page-stack`
   directly), the component should carry **no** `span-*` class at all.

## Fast verification recipe

After any content-grid edit, don't just eyeball a screenshot at whatever
viewport happens to be open — check both desktop and mobile explicitly
(this bug can look fine on one and broken on the other depending on scroll
position when the screenshot was taken):

```js
// Run in the browser console / javascript_tool against the live preview.
// A healthy span-12 child's width should equal (or nearly equal) its
// .content-grid parent's width. A collapsed one will be a fraction of it.
[...document.querySelectorAll('.content-grid > *')].map(el => ({
  tag: el.tagName, cls: el.className,
  width: el.getBoundingClientRect().width,
  parentWidth: el.parentElement.getBoundingClientRect().width,
}));
```

Then use the Browser pane tools: screenshot at desktop width (~1280–1400px)
AND at the `mobile` resize preset, for every page touched — not just one.
