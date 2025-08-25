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
   * Simple markdown to HTML converter
   */
  markdownToHtml(markdown) {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Code blocks
    html = html.replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```/g, '').trim();
      return `<pre><code>${code}</code></pre>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Lists
    html = html.replace(/^\d+\.\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/^-\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
    
    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>|<ol>|<pre>)/g, '$1');
    html = html.replace(/(<\/ul>|<\/ol>|<\/pre>)<\/p>/g, '$1');
    
    return html;
  }

  /**
   * Load blog posts from embedded data (GitHub Pages compatible)
   */
  async loadPosts() {
    try {
      // Use embedded blog data instead of fetching files
      this.posts = getAllBlogPosts();
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
    
    return `
      <li class="blog-post" data-post-id="${post.id}">
        <div class="blog-title">
          <a href="#" onclick="blogManager.openPost('${post.id}')">${post.title}</a>
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
        <a href="#" class="read-more" onclick="blogManager.openPost('${post.id}')">Read More</a>
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

  /**
   * Open individual blog post
   */
  openPost(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    this.currentPost = post;
    
    // Create a new page or modal for the full post
    const postWindow = window.open('', '_blank');
    const postHtml = this.generateFullPostHtml(post);
    postWindow.document.write(postHtml);
    postWindow.document.close();
  }

  /**
   * Generate full post HTML
   */
  generateFullPostHtml(post) {
    const formattedDate = this.formatDate(post.date);
    const tags = Array.isArray(post.tags) ? 
      post.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${post.title} - Xunjian Yin</title>
        <link rel="stylesheet" type="text/css" href="stylesheet.css">
        <link rel="stylesheet" type="text/css" href="blog-styles.css">
        <link rel="icon" type="image/png" href="figures/logo.png">
      </head>
      <body>
        <div class="post-container">
          <a href="javascript:window.close()" class="back-link">← Back to Blog</a>
          <header class="post-header">
            <h1 class="post-title">${post.title}</h1>
            <div class="post-meta">
              <span>${formattedDate}</span> • 
              <span>by ${post.author}</span> • 
              <span>${post.readTime} min read</span>
            </div>
            ${tags ? `<div class="post-tags">${tags}</div>` : ''}
          </header>
          <div class="post-content">
            ${post.htmlContent}
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Global instance
const blogManager = new BlogManager(); 