const isProduction = process.env.NODE_ENV === "production";

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export const log = {
  info(tag: string, msg: string) {
    if (!isProduction) process.stdout.write(`${timestamp()} [${tag}] ${msg}\n`);
  },
  warn(tag: string, msg: string) {
    process.stderr.write(`${timestamp()} [${tag}] WARN: ${msg}\n`);
  },
  error(tag: string, msg: string) {
    process.stderr.write(`${timestamp()} [${tag}] ERROR: ${msg}\n`);
  },
};
