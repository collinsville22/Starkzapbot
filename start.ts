import "dotenv/config";

async function main() {
  await import("./packages/backend/src/index.js");

  await import("./packages/bot/src/index.js");
}

main();
