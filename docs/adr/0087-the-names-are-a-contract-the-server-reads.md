# 0087. The names are a contract the server reads

- Status: accepted
- Date: 2026-10-07
- Amended 2026-10-07: a second reader, a click on water - a river, a lake, the sea - which asks the server and is
  answered by name; and a third, a roll with a window open on water.

## Context

Earth's names are carried through a master's origin map into `names.json` and `regions.bin` beside its tiles
(experiment 0016, `docs/plans/real-world-names.md`): the towns of 1790, the rivers, lakes and peaks, and the
named sea and stretch of land of every square. The page draws them under the Info map and reads them out under
the Origin renderer. The game server knows none of them, so a choice roll aimed at the Vistula reads *River*,
and a questline has no way to name a place. And the copy beside the tiles is served to any page that asks for
it: every name in the world, fog or no fog.

## Decision

**The names are filed twice, the same bytes**: beside the master's tiles for the page, and beside its ground map
in `world/ground/<master>/`, which nothing serves, for the game server. `world:names` and `world:origin` write
both; the quick start carries them again when the server's copy is missing or older than the review, and
whatever remakes the page's copy remakes the server's with it.

**The server reads them through a port, as it reads the ground** (0084): `PlaceNames` in `application`, the names
and the two questions asked of them so far - the named things of a kind near a place, nearest first, and the land
and the sea a place is in or by - and `FolderNames` in `app` over the folder, kept until `names.json` is written
again.

**The shape is a contract.** `contracts/fixtures/names.json` holds a `names.json` and its `regions.bin` as the
world package's encoder, `src/namesFile.ts`, writes them. A test there holds the encoder to the fixture field
for field and byte for byte, from inputs written out as the TypeScript types say; a test in `app` reads the
fixture through `FolderNames`. A field renamed at one end fails that end's test, and a fixture changed fails the
other's. What the contract says:

- **`names.json`**: `master`, `counts`, `columns` and `rows` - the origin map's squares, which `regions.bin`
  numbers - and `names` and `regions`.
- **A name**: `id`, the real world's identity of it, a Wikidata id where the source has one, which never changes
  when Adam repaints and is what anything that names a place keys by; `kind`, `river`, `lake`, `peak` or `town`;
  `name`, in English; `form`, `1790` where the review chose the name and `today` until one has; `also`, `rank`,
  `from`, and `elevation` for a peak; `at` and `earth`, where its name stands in the world and on Earth, as
  `[longitude, latitude]`; `lines`, a river's runs or a lake's shores in the world; and `about`, a line or two
  about a river or a lake for the window on it, where `world/names/about.json` has one.
- **A region**: `id`, `kind`, `sea` or `land`, `name`, `feature`, `rank` and `from`, and `at` and `squares` for one
  given any square; `form`, `1790`, and `also`, today's name, where the review chose its name - the German Ocean,
  the North Sea today; and `about`, a line or two about a sea, as for a name.
- **`regions.bin`**: two layers, the land each square is in and then the sea it is by, each a little-endian
  sixteen-bit number a square, a row at a time from the north-west, counting `regions` from one, nought for none.

A reader leaves out what it cannot read rather than refusing the file, so a server with fewer names still rolls.

**The first reader is the map's omens, and the ground says whether while the names say what.** A river in the
looking circle is *The Vistula* and the open sea *The Baltic Sea*, under the keys a river and the open sea had
before, so every pool that opened on them still does. A town of 1790 standing in the circle, zoomed in as close
as houses are named, is an omen of its own, *Near Dantzic*, keyed `map.town:<id>`: what a pool or a questline
will open on.

**The second reader is a click on water.** A click on the map that hit no house, person or area sends
`inspectAt` with the place, and the gateway answers `inspectedAt`: whether the house has revealed it, and the water
there - a lake whose carried shores enclose the place, a river where the master's ground map shows one and the
named river close enough to be the one painted there, as the omen finds it, or the sea by the named sea the place
is in or by - or none. A third question is asked of the names for it, which named thing's lines enclose a place.
The page opens an inspect window on the water it names, keyed by its `id`, so two clicks on the Vistula are one
window, with the line about it the answer carries. The answer carries where the water runs, too: a river's whole
course, every piece of it under its name that joins the one pointed at, and a lake's shores, cut to what the fog
lets through, which the ripple of gold a click sends runs out along. The page's copy of the names is not
what it reads.

**The third reader is a roll with a window open on water.** `roll` says where each was opened, never what
water it is, and the roll reads every place again as the click was answered, on ground the house has revealed:
*Inspecting the Vistula*, keyed `window.river:<id>`, `window.lake:<id>` or `window.sea:<id>`, and by the kind alone
for water nobody has named, so a pool opens on any of them and a questline on one.

**Only what the house has revealed is named**, as only revealed ground counts (0084): a town under the fog is
no omen, a river is named from a revealed cell the ground shows it in, and the sea from the revealed water.

**The page's copy is an instrument.** It names everything, fog or no fog, and it is there for the Info map and
the Origin renderer, which are Adam's (0023). A player learns a name from the server - an omen today, whatever
else the server sends later - and never from the copy beside the tiles; before the world opens to players that
copy stops being served, as the stands left the served folder (0067).

## Consequences

- Names reach the player for the first time, so an anachronism is now the player's to see. Natural Earth files
  its canals as rivers and its reservoirs as lakes, and nearly all of both - Suez, Panama, the Caledonian, Lake
  Nasser - were made after 1790, so none is carried until a review dates it; the rivers, lakes and seas keep
  today's names until a review gives them their 1790 ones.
- A quest can name a place by its `id` and find it in any master: wherever Adam moved it, or nowhere if he
  removed it.
- Two copies a master, five megabytes each, and the server holds a master's names in memory: some 140,000 points
  of line, filed by the degree square they cross, so that a question reads only the squares about it.
- A tree that carried its names before this has no server copy until `world:names` runs again, and the quick
  start does that when it sees one missing.

## Alternatives considered

- **The server reads the page's copy.** One copy, and the server reaching into the folder the page is served
  from, which the stands left on purpose (0067).
- **A file of the server's own**, holding only what it asks. Smaller, and two shapes to keep in step, when the
  questlines will ask for more than the omens do.
- **No contract but the code**, as the ground map has. The names are larger and will be read by more, so a
  renamed field should fail a test rather than quietly name nothing.
