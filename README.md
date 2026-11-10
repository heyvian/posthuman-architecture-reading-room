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
- Avatar drawings use six stable procedural grammars, an individual color, and ten transferable visual traits that change their geometry; Advanced mode can edit grammar and traits on a new branch
- Configure, Simulate, Diary, and Evolution use the same procedural SVG geometry: compressed organic room-cells share exact wall paths, while avatar grammars remain recognizable as traits evolve
- The diary shows each generation with stable room and avatar identities; Evolution compares initial and evolved rooms and occupants side by side at a consistent scale
- Newly added avatars receive broadly varied model traits, which shape their distinct generated drawings
- An experiment-level diary comparison of the initial arrangement and current system, plus per-generation before/after maps and avatar marks
- An abstract, evolving floor plan: rooms change outline, area, position, and service marks in response to inhabitants’ mobility, collective behaviour, resource needs, and environmental fit; shared pressure can form adjoining rooms and persistently unused peripheral rooms can recede
- Journeys reshape spatial relationships: connected rooms press together, and each threshold is shown at a shared wall; repeated contact leaves persistent, localized visual traits in shared walls
- Generation summaries show the exact rooms an avatar traversed; repeated use visibly layers and textures room walls, changes room size, and returns room outlines and resource patterns as imprints on avatar drawings
- Deterministic 1/5/10-generation runs with a visual playback for multi-generation simulations
- A plan diagram of avatar locations, bubble-like rooms that touch and change shape, visible resource stores, and avatar-influenced doors; each generation records interactions, spatial changes, rules, causes, and complete before/after states
- A generation diary, branching from any recorded generation, branch comparison, evidence-based pattern summaries, and an evolution chart
- A plain-language evolution story that explains route changes, resource shortfalls, social proximity, and what the state-change count represents
- Multiple named experiments saved locally in the browser with IndexedDB, schema-validated JSON import/export, and readable diary text export; no PDFs are uploaded or hosted

## Configurator model

`coevolution-model.js` is the pure simulation engine. It defines bounded avatar attributes, an initially clustered plan of eight touching rooms, deterministic movement and space choice, resource use and redistribution, environmental fit, social encounters, and rule-triggered avatar and architectural changes. Rooms grow or recede, change shape and position, and gain or lose service marks; shared pressure can form adjoining rooms, while unused peripheral rooms can be absorbed. Doors are rendered only at shared thresholds rather than as continuous corridor lines, and their color, texture, and layered wear reflect recorded use. The model stores input/output snapshots and event IDs for each generation. Branch edits preserve the selected history; they do not rewrite earlier states. Import validation checks state bounds and that every recorded change references an interaction event and rule.

The simulation is an explicit, limited thought experiment—not a prediction, a biological model, or a claim that one rule fits all life. Its abstract floor plan and numeric proxies cannot represent lived experience, ecological complexity, or unequal power. The configurator links directly to selected Reading Room cards, including Haque on Pask, Negroponte, Wiscombe, Kimmerer, and Macfarlane.

The default setup uses named scenarios and interpretive language before exposing detailed model controls. Each new experiment assigns each initial avatar a random stable drawing identity, one of six procedural grammars, and an individual color; newly added and duplicated avatars receive the same kind of identity. The ten visual traits alter the proportions and details of each grammar, so the base form stays recognizable while its drawing changes. The independent `coevolution-visuals.js` module renders all six grammars and the room plan from saved simulation state. Room cells share the same curved SVG boundary; recorded boundary segments deform that line and add trait-specific marks, and recorded avatar traits drive the avatar’s geometry. Configure, Simulate, Diary, and Evolution reuse that renderer, with the diary showing each generation and Evolution comparing initial and evolved states side by side. At a shared boundary, repeated contact gradually accumulates avatar traits in a deterministic local segment; later avatars encountering that altered segment acquire traits, with source provenance recorded in their history. In the model, inhabitants’ needs and behaviors reshape the plan itself: shared resource demand can enlarge or service a room or generate another, repeated movement draws connected spaces together, and unused rooms can shrink or disappear. The marks remain abstract architectural drawings, not portraits, biological representations, or physical predictions; avatar drawing DNA does not affect simulation outcomes.

Experiment records are stored in the browser that created them; they are not synchronized between devices. Use JSON export for a portable copy. If IndexedDB is unavailable, the page reports that local saving is unavailable rather than claiming the experiment was persisted.

## Reading entries

Edit `data.js` to curate reading cards. Keep direct excerpts distinguishable from original editorial reading prompts. Attribute every excerpt and include its supplied-PDF locator where available; verify wording and pagination against the published edition before formal use. `quote` is the short card-face excerpt; `fullQuote` expands it in the detail view, and `quoteLocator` records its source location. `excerptNote` flags image-only files for which no passage could be transcribed. Add reliable links to publisher, archive, or library records in `sources` when available; the full citation remains in `citation`.

The MoMA Magazine and ACM Digital Library links came from the group’s pitch and still need bibliographic verification. The initial course PDFs are course outlines and reading-list handouts; the group later supplied eleven reading PDFs and seven additional unique readings, plus four reattached copies of earlier readings. Short excerpts from text-readable files are labeled with PDF-page locators; the Banham, Woods, “Discreteness,” Tafuri, Venturi, Eisenman, and Foucault scans yielded no selectable text and are not quoted. Cards for Kimmerer’s additional books, Beresford-Kroeger, and the literary works use attributed reading prompts because their full texts were not supplied. The direct *Braiding Sweetgrass* excerpt is sourced to the publisher page and needs a page number checked in the group’s edition.

The app is a citation and reading-card catalog. It does not upload, store, or distribute PDFs.

The configurator UI, IndexedDB adapter, and shared geometry renderer are in `coevolution-app.js`, `coevolution-storage.js`, and `coevolution-visuals.js`; its independent styles are in `configurator.css`. Run the model and renderer tests with `node --test`.

## Process log

The visible process-log section records the human-provided research question, source links, group roster, attached course reading lists, author interests, and editorial decisions. It distinguishes those inputs from AI-suggested additional authors and generated card prompts. It documents this conversation only; the group should add off-platform research, source verification, and any corrections or edits made by members before submission.
