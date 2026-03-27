# Progress

- Created planning files for the shell-centralization and blog-parser migration.
- Audited the current site structure, repeated shell markup, and blog rendering path.
- Added `site-shell.js` to inject the shared nav, footer, skip link, and back-to-top button.
- Centralized common page-shell spacing in `shared-styles.css` and removed repeated shell markup/styles from the top-level pages and paper pages.
- Vendored `marked` in `vendor/marked.umd.js` and switched blog rendering from the custom regex converter to `marked.parse(...)`.
- Verified the home page, blog index, blog post pages, photography page, and a representative paper page in a local browser.
- Confirmed theme toggling still works after shell injection and that blog list links now navigate directly to `blog-post.html?id=...`.
