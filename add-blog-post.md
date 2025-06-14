# How to Add New Blog Posts

Since GitHub Pages doesn't allow fetching markdown files directly, the blog system now uses embedded JavaScript data. Here's how to add new blog posts:

## Step 1: Add your blog post data to `blog-data.js`

Add a new object to the `blogPosts` array in `blog-data.js`:

```javascript
{
  id: "your-post-id", // Use kebab-case, no spaces
  title: "Your Post Title",
  date: "2025-01-15", // YYYY-MM-DD format
  author: "Xunjian Yin",
  excerpt: "A brief description of your post that appears in the preview.",
  tags: ["Tag1", "Tag2", "Tag3"], // Array of tags
  readTime: 5, // Estimated reading time in minutes
  content: `Your markdown content here...`, // Raw markdown
  htmlContent: `<p>Your HTML content here...</p>` // Converted HTML
}
```

## Step 2: Content Formats

You can use either:

1. **Simple HTML** (recommended for short posts):
   ```javascript
   htmlContent: `<p>Your content with <a href="https://example.com">links</a> and <strong>formatting</strong>.</p>`
   ```

2. **Markdown in content + HTML conversion**:
   ```javascript
   content: `# Your Title\n\nYour **markdown** content here...`,
   htmlContent: `<h1>Your Title</h1><p>Your <strong>markdown</strong> content here...</p>`
   ```

## Step 3: Deploy

After updating `blog-data.js`, commit and push to GitHub. The changes will be live on GitHub Pages.

## Example Entry

```javascript
{
  id: "my-research-journey",
  title: "My Research Journey in AI",
  date: "2025-01-15",
  author: "Xunjian Yin",
  excerpt: "Reflections on my path through AI research and what I've learned.",
  tags: ["AI", "Research", "Personal"],
  readTime: 8,
  content: `# My Research Journey\n\nThis is my story...`,
  htmlContent: `<h1>My Research Journey</h1><p>This is my story...</p>`
}
```

## Notes

- The `id` should be unique and URL-friendly (use kebab-case)
- Posts are automatically sorted by date (newest first)
- Tags are displayed as clickable elements
- The `excerpt` appears in the blog list preview
- Both `content` and `htmlContent` are optional, but `htmlContent` is used for display 