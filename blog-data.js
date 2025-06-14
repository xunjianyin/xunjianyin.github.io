/**
 * Blog Posts Data
 * Contains all blog posts in JavaScript format to avoid GitHub Pages fetch restrictions
 */

const blogPosts = [
  {
    id: "overview-of-model-editing",
    title: "Overview of Model Editing",
    date: "2023-02-25",
    author: "Xunjian Yin",
    excerpt: "A brief overview of model editing techniques in Chinese.",
    tags: ["LLM", "Model Editing", "Survey"],
    readTime: 5,
    content: `[A Brief Overview of Model Editing in the Early Stage (2023)](https://zhuanlan.zhihu.com/p/609177437)`,
    htmlContent: `<p><a href="https://zhuanlan.zhihu.com/p/609177437">A Brief Overview of Model Editing in the Early Stage (2023)</a></p>`
  }
];

// Helper function to get all blog posts
function getAllBlogPosts() {
  return blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Helper function to get a specific blog post by ID
function getBlogPost(id) {
  return blogPosts.find(post => post.id === id);
} 