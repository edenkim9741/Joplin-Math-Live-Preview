// Joplin injects this global into the plugin runner. The official plugin
// template's `api` module exports the same value as its default export.
const joplin = globalThis.joplin;
export default joplin;
