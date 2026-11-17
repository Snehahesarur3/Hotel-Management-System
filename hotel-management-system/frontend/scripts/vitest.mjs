// Launches Vitest from a working directory with an upper-case Windows drive letter.
// When a terminal opens the project as "c:\..." Node and Vitest resolve the same module under
// two different paths ("c:" and "C:"), load it twice and fail with "failed to find the current suite".
// On macOS/Linux this is a plain pass-through.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase())
const vitestBin = path.join(path.dirname(createRequire(path.join(cwd, 'package.json')).resolve('vitest/package.json')), 'vitest.mjs')

const result = spawnSync(process.execPath, [vitestBin, ...process.argv.slice(2)], { cwd, stdio: 'inherit' })
process.exit(result.status ?? 1)
