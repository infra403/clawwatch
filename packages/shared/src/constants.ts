import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAWWATCH_DIR = join(homedir(), '.clawwatch');

export const SOCKET_PATH = join(CLAWWATCH_DIR, 'engine.sock');
export const DB_PATH = join(CLAWWATCH_DIR, 'clawwatch.db');
export const CONFIG_PATH = join(CLAWWATCH_DIR, 'config.json');

export const DEFAULT_DASHBOARD_PORT = 18800;
export const RING_BUFFER_SIZE = 10000;

export const CLAWWATCH_HOME = CLAWWATCH_DIR;
