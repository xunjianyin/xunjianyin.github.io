# Findings

- All top-level pages and 24 paper pages duplicate the navigation, footer, and back-to-top markup.
- Most non-home top-level pages also duplicate the same 820px page wrapper spacing in inline `<style>` blocks.
- `blog-manager.js` uses a handcrafted regex-based markdown-to-HTML converter.
- The shared config file exists but is not used anywhere yet.
- After the refactor, the duplicated shell markup is removed from the HTML entry points and replaced with shared shell mounts.
- Runtime verification on the local server showed correct nav highlighting for top-level pages, blog posts, photography, and paper pages.
- The vendored `marked` parser renders blog post structure correctly, including headings, paragraphs, and lists.
