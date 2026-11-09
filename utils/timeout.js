const { execFile } = require('node:child_process');

class CommandExecutionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CommandExecutionError';
    Object.assign(this, details);
  }
}

function execWithTimeout(file, args = [], options = {}) {
  const timeoutMs = Number(options.timeoutMs || 10_000);
  const maxOutputBytes = Number(options.maxOutputBytes || 1_048_576);
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };

    const child = execFile(file, args, {
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
      maxBuffer: maxOutputBytes,
      windowsHide: true,
    }, (error, stdout = '', stderr = '') => {
      const durationMs = Date.now() - startedAt;
      const output = { stdout: String(stdout), stderr: String(stderr), durationMs };

      if (!error) return finish(resolve, { ...output, exitCode: 0 });

      const timedOut = error.killed === true || error.signal === 'SIGKILL' || error.code === 'ETIMEDOUT';
      const missingExecutable = error.code === 'ENOENT';
      const outputLimit = error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
      finish(reject, new CommandExecutionError(
        timedOut ? 'Command timed out' : missingExecutable ? 'Executable not found' : outputLimit ? 'Command output exceeded limit' : 'Command failed',
        {
          code: timedOut ? 'TIMEOUT' : missingExecutable ? 'MISSING_EXECUTABLE' : outputLimit ? 'OUTPUT_LIMIT' : 'PROCESS_ERROR',
          exitCode: typeof error.code === 'number' ? error.code : error.status ?? null,
          signal: error.signal || null,
          timedOut,
          missingExecutable,
          outputLimit,
          stdout: output.stdout,
          stderr: output.stderr,
          durationMs,
        }
      ));
    });

    if (child && typeof child.once === 'function') child.once('error', () => {});
  });
}

module.exports = { execWithTimeout, CommandExecutionError };
