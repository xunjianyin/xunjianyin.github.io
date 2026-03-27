/**
 * Blog Management System
 * Handles parsing markdown files and rendering blog posts
 */

class BlogManager {
  constructor() {
    this.posts = [];
    this.currentPost = null;
  }

  /**
   * Parse markdown frontmatter and content
   */
  parseMarkdown(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return { metadata: {}, content: content };
    }

    const frontmatter = match[1];
    const markdownContent = match[2];
    
    // Parse YAML-like frontmatter
    const metadata = {};
    frontmatter.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Parse arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(item => 
            item.trim().replace(/['"]/g, '')
          );
        }
        
        // Parse numbers
        if (!isNaN(value) && value !== '') {
          value = parseInt(value);
        }
        
        metadata[key] = value;
      }
    });

    return { metadata, content: markdownContent };
  }

  /**
   * Convert markdown to HTML using the vendored marked parser.
   */
  markdownToHtml(markdown) {
    if (typeof marked === 'undefined' || typeof marked.parse !== 'function') {
      console.warn('Marked is not available. Falling back to plain text rendering.');
      return `<p>${markdown}</p>`;
    }

    return marked.parse(markdown);
  }

  /**
   * Load blog posts from embedded data and fetch markdown content
   */
  async loadPosts() {
    try {
      // Get blog post metadata from embedded data
      const postsData = getAllBlogPosts();
      
      // Load markdown content for posts that have markdownFile property
      this.posts = await Promise.all(postsData.map(async (post) => {
        if (post.markdownFile) {
          try {
            const response = await fetch(encodeURI(post.markdownFile));
            if (response.ok) {
              const rawMarkdownContent = await response.text();
              const parsedContent = this.parseMarkdown(rawMarkdownContent);
              
              return {
                ...post,
                ...parsedContent.metadata,
                content: rawMarkdownContent,
                htmlContent: this.markdownToHtml(parsedContent.content)
              };
            } else {
              console.warn(`Failed to load markdown file: ${post.markdownFile}`);
              return post;
            }
          } catch (error) {
            console.warn(`Error loading markdown file ${post.markdownFile}:`, error);
            return post;
          }
        }
        return post;
      }));
      
      return this.posts;
    } catch (error) {
      console.error('Error loading blog posts:', error);
      this.posts = [];
      return this.posts;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Generate blog post preview HTML
   */
  generatePostPreview(post) {
    const formattedDate = this.formatDate(post.date);
    const tags = Array.isArray(post.tags) ? post.tags.join(', ') : '';
    const postUrl = `blog-post.html?id=${encodeURIComponent(post.id)}`;
    
    return `
      <li class="blog-post" data-post-id="${post.id}">
        <div class="blog-title">
          <a href="${postUrl}">${post.title}</a>
        </div>
        <div class="blog-meta">
          <span class="blog-date">${formattedDate}</span>
          <span class="blog-author">by ${post.author}</span>
          <span class="blog-read-time">${post.readTime} min read</span>
        </div>
        ${tags ? `<div class="blog-tags">${tags}</div>` : ''}
        <div class="blog-excerpt">
          <p>${post.excerpt}</p>
        </div>
        <a href="${postUrl}" class="read-more">Read More</a>
      </li>
    `;
  }

  /**
   * Render blog list
   */
  renderBlogList() {
    const container = document.getElementById('blog-posts-container');
    if (!container) return;

    if (this.posts.length === 0) {
      container.innerHTML = `
        <li class="coming-soon">
          <h2>Coming Soon!</h2>
          <p>I'm working on some interesting blog posts about my research and experiences in AI and NLP.</p>
          <p>Check back soon for updates!</p>
        </li>
      `;
      return;
    }

    container.innerHTML = this.posts.map(post => this.generatePostPreview(post)).join('');
  }
}

// Global instance
const blogManager = new BlogManager(); 
