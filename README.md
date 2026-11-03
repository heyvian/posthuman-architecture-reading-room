# Cybernetics & More-than-Human Architecture — Reading Room

A small, responsive reading-room web app and assignment prototype for ARCH 602 Theory Class. Group Sweet Chili Heat: Evan Winther, Steff Siu, Vian Esterhuizen, and Victoria Shaw.

The human-authored pitch asks: **How do we design for post-humanism in architecture, and how do we consider future needs of non-human users?** The reading room brings together the group’s supplied pitch sources, readings identified in the ARCH 602 course PDFs, and additional literary, ecological, and theoretical directions.

## Run locally

Open `index.html` in a browser. This prototype uses plain HTML, CSS, and JavaScript; no build step or package installation is required. Google Fonts are loaded remotely, with system font fallbacks.

## What is here

- Searchable reading cards scattered and overlapped across a tabletop, with graphic covers, quotes, tags, and taxonomy filters
- A selected-card view that softens the pile and surfaces three related readings from distinct categories
- A slide-out detail view with summaries, references, and citation fields; it adapts to a bottom drawer on narrower screens
- Search across reading prompts, tags, source notes, and citations
- 40 reading cards spanning cybernetics, architecture, more-than-human theory, ecology, and speculative fiction
- A newly shuffled card order on each page load, held steady while searching and filtering
- A process log distinguishing human-provided ideas and sources from AI contributions

## Reading entries

Edit `data.js` to curate reading cards. Keep direct excerpts distinguishable from original editorial reading prompts. Attribute every excerpt and include its supplied-PDF locator where available; verify wording and pagination against the published edition before formal use. `quote` is the short card-face excerpt; `fullQuote` expands it in the detail view, and `quoteLocator` records its source location. `excerptNote` flags image-only files for which no passage could be transcribed. Add reliable links to publisher, archive, or library records in `sources` when available; the full citation remains in `citation`.

The MoMA Magazine and ACM Digital Library links came from the group’s pitch and still need bibliographic verification. The initial course PDFs are course outlines and reading-list handouts; the group later supplied eleven reading PDFs and seven additional unique readings, plus four reattached copies of earlier readings. Short excerpts from text-readable files are labeled with PDF-page locators; the Banham, Woods, “Discreteness,” Tafuri, Venturi, Eisenman, and Foucault scans yielded no selectable text and are not quoted. Cards for Kimmerer’s additional books, Beresford-Kroeger, and the literary works use attributed reading prompts because their full texts were not supplied. The direct *Braiding Sweetgrass* excerpt is sourced to the publisher page and needs a page number checked in the group’s edition.

The app is a citation and reading-card catalog. It does not upload, store, or distribute PDFs.

## Process log

The visible process-log section records the human-provided research question, source links, group roster, attached course reading lists, author interests, and editorial decisions. It distinguishes those inputs from AI-suggested additional authors and generated card prompts. It documents this conversation only; the group should add off-platform research, source verification, and any corrections or edits made by members before submission.
