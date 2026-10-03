const path = require('path');

// Absolute config path (anchored to this file, not process.cwd()) so CSS
// builds identically whether Next runs from apps/web or the repo root.
module.exports = {
  plugins: {
    tailwindcss: { config: path.join(__dirname, 'tailwind.config.ts') },
    autoprefixer: {},
  },
};
