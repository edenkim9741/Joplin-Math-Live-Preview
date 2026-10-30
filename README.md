# Math Live Preview — Joplin CodeMirror 6

A small experimental Joplin plugin that renders `$...$`, `$$...$$`, `\\(...\\)`, and `\\[...\\]` through KaTeX whenever the caret/selection is outside the math expression. Move the caret into it to edit the original Markdown.

## Build

Requires Node.js 20 and npm.

```sh
npm ci
npm run build
```

This creates `com.example.joplin-math-live-preview.jpl` as an uncompressed TAR archive in the project root and `dist/` for development installation. The build stops if required source or packaged files are missing.

## GitHub Release

Push a version tag beginning with `v` (for example, `v0.0.1`) to start the GitHub Actions release workflow. It installs the locked dependencies, builds the plugin, and attaches `com.example.joplin-math-live-preview.jpl` to a GitHub Release with generated release notes.

```sh
git tag v0.0.1
git push origin v0.0.1
```

## Install

Open Joplin desktop → Settings → Plugins → gear → Install from file; select the `.jpl` file, then restart Joplin. Use the CodeMirror 6 Markdown editor, not the Rich Text Editor.

Requires Joplin 2.14 or later. On desktop versions earlier than 3.1, enable the beta Markdown editor in Settings → General before using the plugin.

## Limitations

- This is an experimental community example, **not an official Joplin plugin** and not tested inside a running Joplin installation.
- Inline math may conflict with financial `$` notation. Use delimiters consistently.
- Skips fenced code and simple inline backtick code; complex nested Markdown/code syntax and math inside tables may need additional parsing work.
- Does not alter note contents; the display widget only replaces text visually.
- KaTeX loads its local font files from the packaged plugin's `fonts/` folder.
- If Markdown's built-in Live Preview already decorates the same math range, decorations may conflict; try disabling Joplin's “Render markup in editor” option.

Architecture follows the [official CodeMirror 6 plugin tutorial](https://joplinapp.org/help/api/tutorials/cm6_plugin/): `ContentScriptType.CodeMirrorPlugin`, `wrapper.addExtension`, and `assets()`. CodeMirror modules are left external to prevent duplicate CodeMirror instances.
