import * as os from 'os';
import * as path from 'path';

/**
 * Where all JSON stores and screenshots live. Lives OUTSIDE the app directory
 * (in the OS home dir) on purpose: hosting platforms run the app under a file
 * watcher that restarts it on any change inside the deploy dir, so writing
 * data there would restart the server on every save. Override with PPA_DATA_DIR.
 */
export const DATA_DIR = process.env.PPA_DATA_DIR || path.join(os.homedir(), '.ppa-data');
