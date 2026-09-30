# The component library

> **What belongs here:** the interface's component library - what each component is, the parts it is made
> of, its variants and recipes, how to compose a new pane from it, and how a new component is added. **What
> does not:** why the interface looks the way it does, which is `LOOK-AND-FEEL.md`; how it behaves across
> screen sizes, which is `RESPONSIVE-DESIGN.md`; where the art goes and what the tool does with it, which is
> `AUTHORING-THE-ART.md`; why it is painted art placed by CSS, which is decision record 0068; and the order
> it is being built in, which is `docs/plans/ui-component-library.md`.

**Not built yet.** This is the method as agreed on 2026-09-30, written before the library so that the
library is built to it. Each step of the plan fills in its part, and a line that still says *to come* is a
part nobody has built.

## The page

**`/admin/inspect-ui-components`** is the library, shown. Every component in every variant, every state
and at more than one size, on a desktop and narrowed to a phone. It needs no game server and no map, and
its demonstrations are live: a container can be dragged to any size, a button pressed. It is the page a
component is looked at before it is used anywhere, and the page to read before making a pane.

The page is the catalogue. This document is the method, and does not list what the page already shows.

## The rule

**A component is seen on the page before it is used in the game.** A mechanic that wants something the
library does not have adds it to the library first, in a commit of its own that the page shows, and then
uses it. A component is never built inside a pane and promoted afterwards.

**A component changed is a component changed everywhere**, so a change to one is looked at on the page too,
in every variant, and not only where the change was wanted.

**The library imports nothing from the game.** It knows no house, no event and no gateway; a pane gives it
words, numbers and callbacks. That is what lets the page show it with nothing running.

## A container is layers

A **container** is four layers, and every boxed thing in the interface is one - a pane, a card, a dialog, a
tooltip:

1. **Border** - a nine-slice picture: the corners drawn once, the edges repeated or stretched along the
   box.
2. **Fill** - what is inside the border, a picture that repeats on its own, or nothing.
3. **Embellishments** - none or several pictures pinned to an anchor, a corner or the middle of an edge.
   Each says its **overhang**, how far it stands out past the border, and its **keep-out**, how much room
   it takes from the content. Neither is part of the nine-slice.
4. **Content** - set in from the border by the border's own inset and by every keep-out, so the content
   moves aside for a cherub by itself.

A container inside a container is two containers. There is no nesting rule beyond that.

## A recipe names a container

A **recipe** is one named, typed combination of the four layers, in `frontend/apps/web/src/ui/recipes.ts`:

```ts
'pane.house-status': {
  border: 'gilt-baroque',
  fill: 'parchment',
  embellishments: [{ art: 'cherub-seated', anchor: 'top-right', overhang: [24, 18], keepOut: [0, 40] }],
}
```

Recipes are named for what they are used for, `pane.<which>`, `card.<which>`, `dialog.<which>`, so that a
recipe changed is a known set of places changed. A pane uses a recipe and never sets a border of its own.

## Asking for a pane

The words to use are the layers. *A container for the pane that lists the holdings: the gilt border, a
parchment fill, a cherub in the top right corner that takes forty pixels from the top of the content.* That
sentence is a recipe, and at most one new picture in `world/ui/`, which starts as a placeholder.

What the agent says back, before building: the recipe as written, the pictures it reads, which of them are
new and the size to paint each at.

## Adding a component

To come, with step 1 of the plan: the shape of a component's folder, what the page shows for each, and
the states every control is shown in.

## Marks

A mark is drawn in code or painted, one mark at a time, behind the one component. To come, with step 6.

## The components

To come, a line each as they are built: what it is for, its variants, and where on the page it is.
