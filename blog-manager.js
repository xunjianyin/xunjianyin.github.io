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
   * Load blog posts from markdown files
   */
  async loadPosts() {
    // In a real implementation, you would fetch the list of markdown files
    // For now, we'll use a predefined list
    const postFiles = [
      'Overview of Model Editing.md'
    ];

    this.posts = [];
    
    for (const file of postFiles) {
      try {
        const response = await fetch(`blogs/${file}`);
        if (response.ok) {
          const content = await response.text();
          const { metadata, content: markdownContent } = this.parseMarkdown(content);
          
          const post = {
            id: file.replace('.md', ''),
            filename: file,
            ...metadata,
            content: markdownContent,
            htmlContent: this.markdownToHtml(markdownContent)
          };
          
          this.posts.push(post);
        }
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
      }
    }
    
    // Sort posts by date (newest first)
    this.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return this.posts;
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
      <article class="blog-post" data-post-id="${post.id}">
        <h2 class="blog-title">${post.title}</h2>
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
      </article>
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
        <div class="coming-soon">
          <h2>Coming Soon!</h2>
          <p>I'm working on some interesting blog posts about my research and experiences in AI and NLP.</p>
          <p>Check back soon for updates!</p>
        </div>
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
        <link rel="icon" type="image/png" href="figures/logo.png">
        <style>
          .post-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.6;
          }
          .post-header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 1px solid #eee;
            padding-bottom: 20px;
          }
          .post-title {
            font-size: 32px;
            color: var(--primary-color);
            margin-bottom: 10px;
          }
          .post-meta {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
          }
          .post-tags {
            margin-top: 10px;
          }
          .tag {
            display: inline-block;
            background: var(--primary-color);
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            margin: 0 4px;
          }
          .post-content {
            font-size: 16px;
          }
          .post-content h1, .post-content h2, .post-content h3 {
            color: var(--primary-color);
            margin-top: 30px;
            margin-bottom: 15px;
          }
          .post-content p {
            margin-bottom: 15px;
          }
          .post-content ul, .post-content ol {
            margin-bottom: 15px;
            padding-left: 30px;
          }
          .post-content li {
            margin-bottom: 5px;
          }
          .post-content code {
            background: #f5f5f5;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
          }
          .post-content pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 15px 0;
          }
          .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: var(--primary-color);
            text-decoration: none;
          }
          .back-link:hover {
            color: var(--secondary-color);
          }
        </style>
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