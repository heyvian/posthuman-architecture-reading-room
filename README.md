# More-than-Human Architecture — Reading Room

A small, responsive web prototype for a public course reading room about post-humanist approaches to architecture, non-human users, and future architectural discourse. The site owner curates entries; visitors can search, filter, and explore them. It does not host or distribute PDFs.

## Run locally

Open `index.html` in a browser. The prototype uses plain HTML, CSS, and JavaScript; no build step or package installation is required. Google Fonts are loaded remotely, with system font fallbacks.

## What is here

- Visual, responsive reading cards
- Text search across titles, descriptions, tags, and themes
- Theme filters
- An animated right-side detail panel with summaries, tags, and references
- Keyboard shortcuts: `⌘ K` / `Ctrl K` to focus search, `Esc` to close the panel
- Example entries for the supplied cybernetics pitch, living architecture, and *Binti*

## Curating the collection

Edit `data.js`. Each entry includes a title, short description, theme, quote, summary, interpretive note, tags, references, and citation. The supplied MoMA and ACM URLs are included as references for the pitch, but their bibliographic details and claims are intentionally left for verification after reading. Do not publish copyrighted PDFs; link to legitimate sources and share only material you have permission to reproduce.

This is a front-end prototype. It has no administrator login, server-side content store, or PDF upload pipeline yet. A production version will need an owner-only publishing workflow and a backend or content-management system.
