import joplin from 'api';

joplin.plugins.register({
  onStart: async () => {
    await joplin.contentScripts.register(
      'codeMirrorPlugin',
      'com.example.joplin-math-live-preview.cm6',
      './contentScript.js',
    );
  },
});
