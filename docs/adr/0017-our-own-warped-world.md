# 0017. The world is a warped Earth, and it is ours

- Status: accepted
- Date: 2026-09-02

## Context

The game wants to borrow Earth's cultural weight, its recognisable continents and the feeling of standing
somewhere real, while saying plainly that this is not Earth. A public tile service gives the opposite: modern
roads, brand names and place names, all of which name the wrong world, and a coastline that is exactly the one
in every atlas. A wholly invented continent would throw away the borrowing that made the setting attractive in
the first place.

## Decision

Generate our own world by warping the real one, and treat the result as the only world there is.

- The raw material is Natural Earth, which is public domain and carries coastlines, lakes, rivers and places
  and nothing else. No roads, no buildings, no shops. At the 1:50m scale it is under two megabytes a layer.
- The warp is a pure function of a place and one configuration file, `world/warp.json`: a set of control
  points that drag their surroundings, a seeded wobble on every coastline, and an optional turn of the globe.
- It runs offline, at build time. The warped coordinates are the game's coordinates. Nothing at runtime knows
  about the Earth the world came from.
- The map draws that output through a style of our own with no text in it at all, and no tile service.

## Consequences

The world is reproducible from one small file, so it can be tuned by hand and re-rolled, and the same
configuration always yields the same world. Because the warp is applied once and the output is canonical,
sprite placement, click handling and the cell grid all keep working untouched: there is no inverse warp
anywhere in the runtime, which there would have to be in every projection if true coordinates had been kept.

We give up detail. Natural Earth at 1:50m runs out at about zoom 7, and the coastline is visibly faceted by
zoom 10, so the maximum zoom is capped and a house will never sit on a street. That is the right trade for a
world looked down on rather than walked through, and 1:10m data is available at roughly six times the size if
close zoom ever matters.

We also stop depending on a public tile service that promises nothing about availability, which removes a risk
the startup plan flagged, and the whole map becomes three files we serve ourselves.

Two limits are worth stating plainly. Turning the globe drags land across the antimeridian, where a polygon
must be cut in two before Mercator can draw it, so the turn is available but defaults to nothing and offsets
fade to zero near the seam. And the warp only changes what a control point reaches: with no control nearby,
a coastline stays exactly Earth's.

## Alternatives considered

- Restyle the public tiles and drop the labels: much cheaper, and the coastline stays Earth's, so the world
  stays Earth with the names filed off. Worth doing anyway if the warp had failed.
- Warp at render time and keep true coordinates: needs the inverse warp in every click and every projection,
  forever, to avoid a one-time build step.
- Build a fictional continent: total freedom, and it discards the recognition that makes the setting work.
- Warp OpenStreetMap instead of Natural Earth: a heavy pipeline, and it would give us the streets and shops
  we are specifically trying to be rid of.
