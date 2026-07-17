// Tests must never touch the real data store — point them at a throwaway dir.
const os = require('os');
const path = require('path');
const fs = require('fs');

const dir = path.join(os.tmpdir(), 'ppa-test-data-' + process.pid);
fs.rmSync(dir, { recursive: true, force: true });
process.env.PPA_DATA_DIR = dir;
