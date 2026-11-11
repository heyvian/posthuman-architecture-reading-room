# Cybernetics & More-than-Human Architecture — Reading Room

A small, responsive reading-room web app and assignment prototype for ARCH 602 Theory Class. Group Sweet Chili Heat: Evan Winther, Steff Siu, Vian Esterhuizen, and Victoria Shaw.

The human-authored pitch asks: **How do we design for post-humanism in architecture, and how do we consider future needs of non-human users?** The reading room brings together the group’s supplied pitch sources, readings identified in the ARCH 602 course PDFs, and additional literary, ecological, and theoretical directions.

## Run locally

Open `index.html` in a browser. This prototype uses plain HTML, CSS, and JavaScript; no build step or package installation is required. Google Fonts are loaded remotely, with system font fallbacks.

## What is here

- Searchable reading cards scattered and overlapped across a tabletop, with graphic covers, quotes, tags, and taxonomy filters
- A distinct color for each idea category, shared by its filter and reading cards
- A selected-card view that softens the pile and surfaces three related readings from distinct categories
- A slide-out detail view with summaries, references, and citation fields; it adapts to a bottom drawer on narrower screens
- Search across reading prompts, tags, source notes, and citations
- 40 reading cards spanning cybernetics, architecture, more-than-human theory, ecology, and speculative fiction
- A newly shuffled card order on each page load, held steady while searching and filtering
- Two featured course readings under “Sources in conversation,” selected for their close fit with the research question and linked directly to their reading cards
- A native interactive “A History of Becoming” ecology model directly below the card pile, with adjustable conditions, playback controls, and a full-run history timeline that samples older moments more sparsely during long runs
- A process log distinguishing human-provided ideas and sources from AI contributions

## Reading entries

Edit `data.js` to curate reading cards. Keep direct excerpts distinguishable from original editorial reading prompts. Attribute every excerpt and include its supplied-PDF locator where available; verify wording and pagination against the published edition before formal use. `quote` is the short card-face excerpt; `fullQuote` expands it in the detail view, and `quoteLocator` records its source location. Cards based on image-only scans use reading prompts rather than direct excerpts. Add reliable links to publisher, archive, or library records in `sources` when available; the full citation remains in `citation`.

The MoMA Magazine and ACM Digital Library links came from the group’s pitch and still need bibliographic verification. The initial course PDFs are course outlines and reading-list handouts; the group later supplied eleven reading PDFs and seven additional unique readings, plus four reattached copies of earlier readings. Short excerpts from text-readable files are labeled with PDF-page locators; the Banham, Woods, “Discreteness,” Tafuri, Venturi, Eisenman, and Foucault scans yielded no selectable text and are not quoted. Selected literary cards contain short excerpts supplied by the owner; links and locators identify accessible sources where available. The direct *Braiding Sweetgrass* excerpt is sourced to the publisher page and needs a page number checked in the group’s edition.

The *Binti* card also references Janet Seow’s supplied scholarly article on Africanfuturism and Black girlhood; its architectural interpretation comes from the project’s research question. The *Hitchhiker’s Guide* card draws on the owner’s examples and links to a fan reference covering technology across the series.

The app is a citation and reading-card catalog. It does not upload, store, or distribute PDFs.

The “A History of Becoming” section reimplements the supplied prototype as native reading-room markup and JavaScript. Before the simulation starts, place one Exchange, Gather, and Rest room in order by moving the preview blob inside the enclosure and clicking; the simulation begins after the third room is placed. The enclosure starts at approximately 60% of the canvas width and height, leaving room to grow. The simulation yields between frames to keep controls responsive, so high playback speeds depend on the device's capacity. Inhabitants share resources represented by pale green dots; Abundance controls how quickly those resources regenerate. Inhabitants leave fading imprints on a hexagonal grid. Each species' original generated form is compared with its current population average. Encounters gradually and permanently raise that species' inherited anatomical baseline during a run, while individual spatial memories still fade; resetting starts the baseline over. Up to 36 regions can arise where inhabitants gather in available space; they fit around existing regions while their size, shape, and established use change with activity. Neighboring regions of the same type merge and count as one region. The outer wall stays outside region footprints, although inward architectural traces can still touch them. Sustained contact with strong Grower branches or imprints can add small areas at region edges. Unoccupied regions persist, but strong Builder traces erode one small organic area at the region's edge, even in established regions; a cut fills in if later growth encloses it. Continuous wall contact takes 384 ticks; coil imprints take 480. At each wall encounter, inhabitants have an equal chance of following the wall or deflecting away. The simulation remains a speculative model, not a validated ecological or physical prediction.

The recent-events feed updates at 50-tick boundaries, keeping up to five entries. Each update shows the most recent event from that interval, labeled with the tick when it occurred.

Higher Impermanence makes established regions respond to smaller groups sooner, with less weight on inhabitants' past spatial memories when choosing a new use.

Each page load starts a randomly seeded world. Reset restarts the current seed, while New seed starts a different world.

After spending extended time near the boundary, inhabitants gradually turn back toward the interior.

Imprints fade without renewed contact; weaker traces lose strength proportionally faster than stronger ones. The current trial grid has 320 cells, compared with 616 before the spacing change.

## Process log

The visible process-log section records the human-provided research question, source links, group roster, attached course reading lists, author interests, and editorial decisions. It also documents the development of A History of Becoming and its proposed connections to Haque on Pask, Metabolism, the Amsterdam Declaration, and “The Inner Life of Models,” distinguishing interpretation from the readings' claims. It documents this conversation only; the group should add off-platform research, source verification, and any corrections or edits made by members before submission.
