/**
 * Local development on Android: forward the device's localhost:4001 (API) and
 * localhost:9000 (MinIO) to this computer.
 *
 * The backend returns media URLs on MINIO_PUBLIC_URL (http://localhost:9000).
 * PDF, EPUB and audio URLs are presigned, and the signature covers the host, so
 * the device must request exactly that host. Rewriting it to 10.0.2.2 returns 403.
 *
 * `adb reverse` is cleared whenever the emulator or device restarts: re-run
 * `npm run android:reverse`. Harmless when no device is connected.
 */
const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

const PORTS = [4001, 9000]

function findAdb() {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb'
  const roots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk'),
  ].filter(Boolean)
  for (const root of roots) {
    const candidate = path.join(root, 'platform-tools', exe)
    if (existsSync(candidate)) return candidate
  }
  return 'adb'
}

const adb = findAdb()
try {
  for (const port of PORTS) execFileSync(adb, ['reverse', `tcp:${port}`, `tcp:${port}`], { stdio: 'pipe' })
  console.log(`adb reverse: device localhost:${PORTS.join(', localhost:')} -> this computer`)
} catch (err) {
  const detail = err.stderr ? String(err.stderr).trim() : err.message
  console.warn(`adb reverse skipped (${detail}). Start the emulator, then run: npm run android:reverse`)
}
