# AI Marketing Toolkit

A React-based marketing productivity tool powered by the Gemini AI API. Built for the CargoWise marketing team to streamline social copy creation, content generation, and marketing trend analysis.

---

## Features

### Social Generator
Generate distinct social media copy variants for A/B testing, including image overlay copy for social posts.

- Configure product name, target audience, key benefit, tone, and number of variants
- Upload **product reference materials** (PDF or Markdown) to ground copy in accurate product details
- Add **writing style references** via public URLs (blog posts, product pages, PDFs, or Markdown files) — the AI analyses and mirrors the tone and style automatically
- Each variant includes:
  - Post headline, body copy, and call to action
  - **Image overlay copy** — hero message, tagline, and CTA button text ready for design handoff
- Select individual variants and copy them all at once with **Copy Selected Social Posts**

### Marketing Trend Analysis
Get real-time, actionable marketing insights grounded in current industry news.

- Enter any topic (e.g. "Digital trends within the logistics industry")
- Powered by Gemini's Google Search grounding — pulls live data, not just training knowledge
- Each trend surfaces a clear **Action / Insight** and **Recommendation / Marketing Strategy**
- Send any insight directly to the Content Generator with one click

### Content Generator
Draft high-impact B2B marketing content tailored for logistics executives.

- Supports five content types:
  - LinkedIn Post (Short)
  - Blog Post Outline
  - Newsletter Article (Medium)
  - Email Subject Lines & Body
  - Whitepaper / eBook Section Draft
- Accepts insights transferred directly from the Trend Analysis module
- Full markdown rendering with copy-to-clipboard support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Bundler | Vite |
| Styling | Tailwind CSS 3 |
| AI | Google Gemini 2.5 Flash API |
| Deployment | GitHub Pages via `gh-pages` |

---

### Live URL

```
https://your-username.github.io/your-repo-name/
```

---

## Project Structure

```
src/
└── App.jsx          # All components and application logic
public/
└── index.html       # HTML entry point
.env                 # Local environment variables (not committed)
vite.config.js       # Vite config with GitHub Pages base path
tailwind.config.js   # Tailwind config with dark mode enabled
```

---

## Dark Mode

The app automatically detects your operating system's colour preference on first load and applies light or dark mode accordingly. Use the toggle in the top-right header to switch manually at any time.

---

## Writing Style References

The Social Generator supports fetching writing style references from public URLs at generation time. To configure default style sources, edit the `DEFAULT_STYLE_SOURCES` constant at the top of `App.jsx`:

```javascript
const DEFAULT_STYLE_SOURCES = [
  { id: 'cw-brand', label: 'CargoWise Brand Voice', url: 'https://your-url-here.com/brand-voice.pdf' },
  { id: 'cw-tone',  label: 'CargoWise Tone of Voice', url: 'https://your-url-here.com/tone.md' },
];
```

Supported formats: PDF, Markdown (`.md`), and any public web page (blog posts, product pages, etc.).

---

## Security

- The Gemini API key is loaded from environment variables at build time and is **never stored in the repository**
- Ensure `.env` is listed in your `.gitignore`
- This tool is intended for use by a small trusted internal team — the API key will be compiled into the JS bundle, so it should not be deployed as a fully public site without additional access controls
- If your key is ever accidentally exposed, revoke it immediately at [aistudio.google.com](https://aistudio.google.com) and generate a new one

---

## Usage Notes

- The app uses **Gemini 2.5 Flash** (`gemini-2.5-flash`) for all generation tasks
- If you hit a 429 quota error, check your plan and billing at [ai.google.dev](https://ai.google.dev)
- The Marketing Trend Analysis module uses Gemini's Google Search grounding tool — results reflect current web content
- All copy is generated in **American English**

---

## License

Internal tool — not licensed for public distribution.
