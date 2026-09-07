import { spawnSync } from 'node:child_process';
const executable = process.env.EDH_PYTHON || 'python3';
const result = spawnSync(executable, ['scripts/check-python.py'], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
