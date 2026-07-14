import * as path from 'path';

/**
 * Where all JSON stores and screenshots live. Defaults to <app root>/data;
 * override with PPA_DATA_DIR to move it outside the deploy dir (e.g. on hosts
 * whose file watcher would otherwise restart the app on every data write).
 */
export const DATA_DIR = process.env.PPA_DATA_DIR || path.join(__dirname, '..', 'data');
