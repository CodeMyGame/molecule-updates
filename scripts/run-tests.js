const { spawnSync } = require('child_process');
const path = require('path');
const electron = require('electron');

const scriptPath = path.join(__dirname, 'test-happy-flows.js');

console.log('Running Molecule POS Happy Flow Automation...\n');

const result = spawnSync(electron, [scriptPath], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
