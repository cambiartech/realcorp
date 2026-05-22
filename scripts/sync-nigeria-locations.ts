import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const force = process.argv.includes("--force");
  const { syncNigeriaLocationsFromSource } = await import("../src/lib/nigeria-locations-sync");
  console.log(`Syncing Nigeria states + LGAs${force ? " (force refresh)" : ""}…`);
  const result = await syncNigeriaLocationsFromSource(force);
  console.log(`Done: ${result.states} states, ${result.lgas} LGAs from ${result.source}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
