import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const local = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const python = process.env.EDH_PYTHON || (existsSync(local) ? local : 'python3');
const result = spawnSync(
  python,
  ['-m', 'unittest', 'discover', '-s', 'harness/physical-runtime/tests', '-p', 'test_*.py'],
  { stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
