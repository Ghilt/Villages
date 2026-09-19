# Look and feel

> **What belongs here:** the shared visual language — the rules every part of the interface follows, and the
> components more than one mechanic uses. **What does not:** how any single mechanic looks, which is that
> mechanic's own look-and-feel section in `MECHANICS.md`, how the interface behaves across screen sizes
> (`RESPONSIVE-DESIGN.md`), and what the experience is about (`VISION.md`).

This document is new and deliberately thin. A unified component style is worth having and is not a mechanic,
so it is collected here as it is decided, rather than being discovered again inside each feature. Most of it
is not decided yet, and says so.

## The rules

**Diegetic wherever it can be.** What the player is shown should be part of the world rather than a control
panel laid over it. A choice arrives as something on a desk, not as a modal dialog. This is the one settled
thing about the presentation; the theme and tone around it are not (see `VISION.md`).

**Every screen, from the start.** A component is laid out for a phone and a desktop in the increment that
builds it, never in a later pass. See `RESPONSIVE-DESIGN.md`.

**A component is shared, not re-invented.** When a second mechanic needs something the first already showed
the player, it uses the same component and this document gains an entry, rather than each mechanic growing
its own version of a parchment.

## Rarity

Four bands, used wherever a rolled thing is shown, with the standard colours:

| Band | Colour |
|---|---|
| Common | gray |
| Uncommon | green |
| Rare | blue |
| Legendary | orange |

The exact values are not chosen. The bands and their colours are, because a player learns them once and
should never have to learn them again.

## Components

**The desk.** A wooden desktop with an inkwell, on which the world puts things in front of the player. Its
first use is the choice roll.

**The parchment.** A textbox styled as a sheet of parchment, lying on the desk. Hovering one lifts it
slightly, so it reads as something that can be picked up. One parchment carries one option of a choice roll;
what else it might carry is not decided.

## Not decided

- Theme and tone as a whole. See `VISION.md`.
- The exact colours, the type, the grain of the desk, and whether the map's own look leads the rest of the
  interface or stands apart from it.
- Whether the parchment survives contact with a second mechanic, or turns out to be the choice roll's own.
