# Cybernetics & More-than-Human Architecture — Reading Room

A small, responsive reading-room web app and assignment prototype for ARCH 602 Theory Class. Group Sweet Chili Heat: Evan Winther, Steff Siu, Vian Esterhuizen, and Victoria Shaw.

The human-authored pitch asks: **How do we design for post-humanism in architecture, and how do we consider future needs of non-human users?** The reading room brings together the group’s supplied pitch sources, readings identified in the ARCH 602 course PDFs, and additional literary, ecological, and theoretical directions.

## Run locally

Serve the repository root over HTTP (for example, `py -m http.server 8000`) and open `http://localhost:8000`. This prototype uses plain HTML, CSS, and JavaScript; no build step or package installation is required. The configurator uses IndexedDB, which is not consistently available when opening the page directly as a `file://` URL. Google Fonts are loaded remotely, with system font fallbacks.

## What is here

- Searchable reading cards scattered and overlapped across a tabletop, with graphic covers, quotes, tags, and taxonomy filters
- A selected-card view that softens the pile and surfaces three related readings from distinct categories
- A slide-out detail view with summaries, references, and citation fields; it adapts to a bottom drawer on narrower screens
- Search across reading prompts, tags, source notes, and citations
- 40 reading cards spanning cybernetics, architecture, more-than-human theory, ecology, and speculative fiction
- A newly shuffled card order on each page load, held steady while searching and filtering
- Two featured course readings under “Sources in conversation,” selected for their close fit with the research question and linked directly to their reading cards
- A process log distinguishing human-provided ideas and sources from AI contributions
- A separate “A History of Becoming” configurator that opens in a beginner-friendly mode with three starting situations, plain-language slider descriptions, and a four-step Configure / Simulate / Diary / Evolution flow
- An optional Advanced mode exposing the detailed architecture and avatar controls, event evidence, and measured before/after state
- Avatar drawings are generated from each being’s behavioral and environmental traits; there are no controls for choosing a visual style
- Avatar marks use seeded variation within an invisible circular field, with loose, nonliteral linework inspired by architectural plans and drawing conventions
- Newly added avatars receive broadly varied model traits, which shape their distinct generated drawings
- An experiment-level diary comparison of the initial arrangement and current system, plus per-generation before/after maps and avatar marks
- Architecture-inspired spatial nodes and paths that accumulate color and line patterns from recorded visits and traversals; repeated use visibly thickens routes and adds node contours, while both draw from the traits of their visitors
- Generation summaries show the exact spaces an avatar traversed; cumulative drawings show which inhabitants shaped each used node or route, and those node/path imprints return as visible traces in avatar drawings
- Deterministic 1/5/10-generation runs with a visual playback for multi-generation simulations
- A diagram of avatar locations, spaces, resources, and reciprocal connections; each generation records interactions, changes, rules, causes, and complete before/after states
- A generation diary, branching from any recorded generation, branch comparison, evidence-based pattern summaries, and an evolution chart
- A plain-language evolution story that explains route changes, resource shortfalls, social proximity, and what the state-change count represents
- Multiple named experiments saved locally in the browser with IndexedDB, schema-validated JSON import/export, and readable diary text export; no PDFs are uploaded or hosted

## Configurator model

`coevolution-model.js` is the pure simulation engine. It defines bounded avatar attributes, eight linked architectural spaces, deterministic movement and space choice, resource use and redistribution, environmental fit, social encounters, and rule-triggered avatar and architectural changes. The model stores input/output snapshots and event IDs for each generation. Branch edits preserve the selected history; they do not rewrite earlier states. Import validation checks state bounds and that every recorded change references an interaction event and rule.

The simulation is an explicit, limited thought experiment—not a prediction, a biological model, or a claim that one rule fits all life. Its diagrammatic spaces and numeric proxies cannot represent lived experience, ecological complexity, or unequal power. The configurator links directly to selected Reading Room cards, including Haque on Pask, Negroponte, Wiscombe, Kimmerer, and Macfarlane.

The default setup uses named scenarios and interpretive language before exposing detailed model controls. Users can edit avatar needs, preferences, and behavioral traits; they cannot select or tweak visual styles. Each avatar receives a stable generated drawing identity, with a different underlying visual structure such as branching, coiling, segmentation, radial order, reticulation, or lobing. Traits then alter the proportions and detail of that structure as they change. Drawings use controlled repetition and spacing, with limited variation for individuality. After simulation, the system's visible node and path marks accumulate the traits of beings that visit or traverse them; avatar drawings in turn incorporate traces from the places and paths they encounter. The marks remain nonliteral architectural drawings, not portraits, biological representations, or physical predictions, and they do not affect simulation outcomes.

Experiment records are stored in the browser that created them; they are not synchronized between devices. Use JSON export for a portable copy. If IndexedDB is unavailable, the page reports that local saving is unavailable rather than claiming the experiment was persisted.

## Reading entries

Edit `data.js` to curate reading cards. Keep direct excerpts distinguishable from original editorial reading prompts. Attribute every excerpt and include its supplied-PDF locator where available; verify wording and pagination against the published edition before formal use. `quote` is the short card-face excerpt; `fullQuote` expands it in the detail view, and `quoteLocator` records its source location. `excerptNote` flags image-only files for which no passage could be transcribed. Add reliable links to publisher, archive, or library records in `sources` when available; the full citation remains in `citation`.

The MoMA Magazine and ACM Digital Library links came from the group’s pitch and still need bibliographic verification. The initial course PDFs are course outlines and reading-list handouts; the group later supplied eleven reading PDFs and seven additional unique readings, plus four reattached copies of earlier readings. Short excerpts from text-readable files are labeled with PDF-page locators; the Banham, Woods, “Discreteness,” Tafuri, Venturi, Eisenman, and Foucault scans yielded no selectable text and are not quoted. Cards for Kimmerer’s additional books, Beresford-Kroeger, and the literary works use attributed reading prompts because their full texts were not supplied. The direct *Braiding Sweetgrass* excerpt is sourced to the publisher page and needs a page number checked in the group’s edition.

The app is a citation and reading-card catalog. It does not upload, store, or distribute PDFs.

The configurator UI and IndexedDB adapter are in `coevolution-app.js` and `coevolution-storage.js`; its independent styles are in `configurator.css`. The engine’s focused tests run with `node --test tests/coevolution-model.test.js`.

## Process log

The visible process-log section records the human-provided research question, source links, group roster, attached course reading lists, author interests, and editorial decisions. It distinguishes those inputs from AI-suggested additional authors and generated card prompts. It documents this conversation only; the group should add off-platform research, source verification, and any corrections or edits made by members before submission.
