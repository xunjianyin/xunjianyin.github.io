# Task Plan

## Goal
Centralize the shared site shell (navigation, footer, back-to-top, and common page shell spacing) and replace the custom blog markdown parser with a real markdown library.

## Steps
- [completed] Audit duplicated shell markup and current blog rendering flow
- [completed] Add shared shell assets and common shell/page-shell styles
- [completed] Migrate top-level pages and paper pages to shell placeholders
- [completed] Replace regex markdown rendering with a real parser
- [completed] Verify key pages in a local browser and record results

## Notes
- Keep the site static and GitHub Pages-friendly.
- Avoid introducing a build step.
