# UI Style Guide

The app uses a professional light dashboard style: soft white surfaces, slate text, lime accents, subtle borders, and restrained semantic colors.

## Foundations

- App canvas: light slate background with subtle gradients.
- Primary text: `slate-950`; secondary text: `slate-500`; muted labels: `slate-400`.
- Main accent: lime (`lime-300`, `lime-100`, `lime-700`) for positive actions, active badges, and location chips.
- Semantic colors are reserved for meaning: red for destructive or mismatched states, amber for warnings, blue/sky for informational value cards.

## Reusable Classes

Defined in `src/index.css`:

- `surface-card`: main elevated card surface.
- `surface-panel`: smaller nested panel/card.
- `control-input`: shared input/select styling.
- `field-label`: compact uppercase field labels.
- `field-help`: muted helper copy.
- `btn-primary`: primary black action.
- `btn-accent`: lime accent action.
- `btn-secondary`: neutral secondary action.
- `btn-danger`: destructive action.
- `status-chip`: generic status chip.
- `badge-location`: rack/location chip.
- `badge-warning`: missing/warning chip.
- `edit-panel`: product edit state panel.

## Rules

- Do not add new one-off button/input/badge color systems unless a new semantic state requires it.
- Product rack/location uses `badge-location`, not a dark block.
- Product edit forms use `edit-panel`, `field-label`, `control-input`, and shared button classes.
- Avoid heavy green backgrounds for entire headers or cards; use lime as an accent, not the main surface.
