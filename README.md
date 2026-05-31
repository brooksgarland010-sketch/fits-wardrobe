# 👗 FITS — AI Wardrobe App

A beautiful wardrobe app powered by Claude AI. Take photos of your clothes, get AI-generated outfit combinations ranked by style, and track what's dirty.

## Features
- 📸 **Photo upload** — photograph every item in your closet
- ✨ **AI outfit generation** — Claude analyzes your actual clothes and creates stylish outfit combos
- ⭐ **Style rankings** — outfits are scored 1–10 and ranked best to worst
- 🧺 **Dirty tracking** — mark items as dirty; only clean clothes appear in outfits
- 💾 **Local storage** — your wardrobe persists between sessions

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Get an Anthropic API key
Go to https://console.anthropic.com and create an API key.

### 3. Run locally
```bash
npm run dev
```

For local dev, you'll need to temporarily put your API key in `api/claude.js` or use a `.env.local` file:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Then in `api/claude.js`, the key is read via `process.env.ANTHROPIC_API_KEY`.

For local Vercel dev:
```bash
npm install -g vercel
vercel dev
```

### 4. Deploy to Vercel

```bash
vercel
```

Then in your Vercel dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. Add `ANTHROPIC_API_KEY` = your Anthropic API key
3. Redeploy

That's it! Your API key stays secure server-side.

## How it works

- Clothing photos are stored as base64 in `localStorage` (no database needed)
- When you generate outfits, all clean item photos are sent to Claude's vision API
- Claude sees the actual images and creates outfit combinations based on what they look like
- Outfits are ranked by style score (highest first) with tips

## File structure
```
├── api/
│   └── claude.js        # Vercel edge function (keeps API key secure)
├── src/
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```
