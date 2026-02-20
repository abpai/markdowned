# Markdowned

![Markdowned icon](extension/icons/icon-128.png)

Export any webpage to clean Markdown with one click.

The extension works fully offline. No server required.

Markdowned is built for the common workflow where you find something useful and want clean Markdown fast, whether you are sharing with a person, pasting into a coding agent, or dropping context into tools like NotebookLM.

## Chrome Extension

### Install locally (unpacked)

Markdowned is not published on the Chrome Web Store yet, so load it as an unpacked extension:

1. Build the extension:
   ```bash
   bun run build:extension
   ```
2. Open `chrome://extensions`
3. Enable Developer mode
4. Click **Load unpacked** and select `extension/`
5. After making code changes, run `bun run build:extension` again and click **Reload** on the extension card

### Usage

Click the extension icon on any page. Markdown is extracted, copied to your clipboard, and downloaded as a `.md` file.

### Architecture

- Extraction: hybrid strategy using [Readability](https://github.com/mozilla/readability) plus a pruned main-content fallback for app-like pages
- Conversion: [Turndown](https://github.com/mixmark-io/turndown)
- Orchestration: MV3 service worker triggers export, injects content script when needed, and reports badge status
- Naming: export filenames prefer readable titles and avoid UUID-like low-signal page titles
- Runtime: browser-only (no server required for Markdown export)

## Scripts

| Command                   | Description                            |
| ------------------------- | -------------------------------------- |
| `bun run build:extension` | Build extension assets in `extension/` |
| `bun run lint`            | Run ESLint                             |
| `bun run format`          | Run Prettier                           |
| `bun run typecheck`       | Run TypeScript type checking           |
| `bun run check`           | Run lint + typecheck                   |
| `bun run test`            | Run tests                              |
| `bun run test:watch`      | Run tests in watch mode                |
