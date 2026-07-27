const { execFile } = require("child_process");

function execWithTimeout(file, args, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        timeout: timeoutMs,
        maxBuffer: 20 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        console.log("STDOUT:");
        console.log(stdout);

        console.log("STDERR:");
        console.log(stderr);

        console.log("ERROR:");
        console.log(err);

        if (err) {
          return reject(err);
        }

        resolve(stdout.trim());
      }
    );
  });
}

module.exports = { execWithTimeout };