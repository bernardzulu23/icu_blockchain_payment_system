const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const win = process.platform === 'win32';
const venvPython = win
  ? path.join(dir, '.venv', 'Scripts', 'python.exe')
  : path.join(dir, '.venv', 'bin', 'python');

function resolvePython() {
  if (fs.existsSync(venvPython)) return venvPython;
  const py312 = win
    ? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe')
    : '';
  if (py312 && fs.existsSync(py312)) return py312;
  return 'python';
}

const python = resolvePython();
if (!fs.existsSync(venvPython)) {
  console.warn(
    '[ocr] No .venv found. Create one with Python 3.12:\n' +
      '  cd backend/python-services\n' +
      '  py -3.12 -m venv .venv\n' +
      '  .venv\\Scripts\\python -m pip install -r requirements.txt'
  );
}

console.log(`[ocr] starting ${python} api_server.py`);
const child = spawn(python, ['api_server.py'], {
  cwd: dir,
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code || 0));
