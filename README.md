# Durand's Character Creator

Tabletop character sheet creator for Durand's game system.

## Play online

**Live app:** https://sirchanced.github.io/durands-character-creator/

## Local development

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Features

- Header fields: Name, Level, Race, Class, Height, Age, Luck Die, Unused Points, Dodge Adjust
- Stats with ADJ values, Current/Max Health, armor (type, material, body slots)
- Traits, skills, inventory, history, and notes
- Races & Classes catalog with custom entries
- Autosave in the browser; Save/Open JSON files; Print

## Deploy

Pushes to `master` build and publish to GitHub Pages via GitHub Actions.
