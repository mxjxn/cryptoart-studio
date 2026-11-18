# Model viewer customization (TODO)

Studio pins a minimal HTML viewer as `animation_url` for 3D mints today. Future work should make the viewer configurable without changing the on-chain URI scheme.

## Not in scope yet

- Custom colors, backgrounds, lighting presets, and layout variants per collection or artist
- Optional waveform-style geometry thumbnails (for audio-adjacent releases)
- Branding controls (still should default to unbranded)

## Technical notes

- `cryptoart.viewerVersion` and `cryptoart.mediaType: 'model'` identify our viewer pages; generative/HTML templates are owned by a separate track (`mediaType: 'generative' | 'html'`).
- GLB/glTF use `<model-viewer>`; OBJ/FBX use a self-contained three.js page with pinned source files (no server-side conversion).