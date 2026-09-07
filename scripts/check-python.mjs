import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const localPython = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const executable = process.env.EDH_PYTHON || (existsSync(localPython) ? localPython : 'python3');
const result = spawnSync(executable, ['scripts/check-python.py'], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
