# Markdowned

![Markdowned icon](extension/icons/icon-128.png)

Export any webpage to clean Markdown with one click.

The extension works fully offline. No server required.

## Chrome Extension

### Install locally

1. Build the extension:
   ```bash
   bun run build:extension
   ```
2. Open `chrome://extensions`
3. Enable Developer mode
4. Click Load unpacked and select `extension/`

### Usage

Click the extension icon on any page. Markdown is extracted, copied to your clipboard, and downloaded as a `.md` file.

### Architecture

- Extraction: [Readability](https://github.com/mozilla/readability)
- Conversion: [Turndown](https://github.com/mixmark-io/turndown)
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
