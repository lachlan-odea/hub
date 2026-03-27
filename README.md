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

## API Key Setup

This app uses a **per-user API key model** — each person enters their own free Gemini API key on first use. The key is stored only in their browser's `localStorage` and is never included in the source code, build bundle, or repository.

### Getting a key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with a Google account
3. Click **Create API key**
4. Copy the key

### First launch

1. Open the app
2. Paste your Gemini API key into the entry screen
3. Click **Get Started** — the key is validated and saved to your device
4. You won't be asked again on this device

### Updating or removing your key

Click the **API Key** button at the bottom of the sidebar at any time to view or clear your stored key. Clearing it returns you to the key entry screen.

---

## Deployment

This project deploys to GitHub Pages using the `gh-pages` package.

### Live URL

```
https://lachlan-odea.github.io/hub/
```

---

## PWA — Install as a Desktop App

This app is a Progressive Web App (PWA) and can be installed to your desktop or taskbar without any installer or IT involvement.

### How to install

1. Open the app in **Chrome** or **Edge**
2. Click the install icon in the address bar (or go to `...` menu → **Install AI Marketing Toolkit**)
3. The app installs to your desktop and taskbar and opens in its own window

---

## Project Structure

```
src/
└── App.jsx              # All components and application logic
public/
├── index.html           # HTML entry point with PWA meta tags
├── manifest.json        # PWA manifest
├── sw.js                # Service worker for offline caching
└── icons/               # App icons (192px and 512px)
vite.config.js           # Vite config with GitHub Pages base path
tailwind.config.js       # Tailwind config with dark mode enabled
```

---

## Usage Notes

- The app uses **Gemini 2.5 Flash** (`gemini-2.5-flash`) for all generation tasks
- If you hit a 429 quota error, check your plan and billing at [ai.google.dev](https://ai.google.dev)
- The Marketing Trend Analysis module uses Gemini's Google Search grounding tool — results reflect current web content
- All copy is generated in **American English**

---

## License

Internal tool — not licensed for public distribution.
