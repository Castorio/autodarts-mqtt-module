import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';

/**
 * True when the module file is the script Node was started with.
 *
 * Comparing `import.meta.url` with `file://${process.argv[1]}` fails for
 * paths with spaces or other characters that get URL-encoded (macOS
 * "Application Support", the desktop app's data folder) and for Windows
 * drive paths, so the module would exit silently instead of starting.
 */
export function isEntryPoint(moduleUrl: string, scriptPath: string | undefined): boolean {
  if (!scriptPath) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(scriptPath);
  } catch {
    return false;
  }
}
