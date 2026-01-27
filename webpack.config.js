// This file helps WebStorm understand path aliases
// You don't need to use webpack, but WebStorm reads this for path resolution

const path = require('path');

module.exports = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.js', '.json'],
  },
};
