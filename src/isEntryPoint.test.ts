import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { isEntryPoint } from './isEntryPoint.js';

describe('isEntryPoint', () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function entryFile(dirName: string): string {
    root = mkdtempSync(path.join(tmpdir(), 'mqtt-entry-'));
    const dir = path.join(root, dirName, 'dist');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'index.js');
    writeFileSync(file, '');
    return file;
  }

  it('recognises the script when its path contains a space (macOS "Application Support")', () => {
    const file = entryFile('Application Support');
    expect(isEntryPoint(pathToFileURL(file).href, file)).toBe(true);
  });

  it('is false when the module is imported by another script', () => {
    const file = entryFile('modules');
    expect(isEntryPoint(pathToFileURL(file).href, path.join(path.dirname(file), 'other.js'))).toBe(false);
  });

  it('is false without a script argument', () => {
    const file = entryFile('modules');
    expect(isEntryPoint(pathToFileURL(file).href, undefined)).toBe(false);
  });
});
