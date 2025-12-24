# Local RAG Workspaces - Landing Page

This is the static landing page for the Local RAG Workspaces project.

## About

A professional, single-page website that describes the Local RAG Workspaces project and provides a link to the GitHub repository.

## Features

- Modern, responsive design
- Dark theme with gradient accents
- Mobile-friendly layout
- No external dependencies (pure HTML/CSS)
- Fast loading (single HTML file)

## Viewing the Landing Page

### Option 1: Open Directly
Simply open `index.html` in your web browser:
- Double-click the file, or
- Right-click and select "Open with" your preferred browser

### Option 2: Serve with Python
```bash
cd landing-page
python -m http.server 8080
```
Then visit: http://localhost:8080

### Option 3: Serve with Node.js
```bash
cd landing-page
npx serve
```

## Deployment

This landing page can be deployed to any static hosting service:

- **GitHub Pages**: Push to a `gh-pages` branch
- **Netlify**: Drag and drop the `landing-page` folder
- **Vercel**: Deploy via CLI or web interface
- **Cloudflare Pages**: Connect your repository
- **Any web server**: Upload `index.html` to your server

## Customization

The landing page is a single HTML file with inline CSS. To customize:

1. Open `index.html` in your text editor
2. Modify the CSS variables in the `:root` section to change colors:
   ```css
   :root {
       --primary: #6366f1;
       --secondary: #8b5cf6;
       --bg-dark: #0f172a;
       /* ... other variables */
   }
   ```
3. Edit the content sections as needed
4. Save and refresh your browser

## License

Same as the main project.
