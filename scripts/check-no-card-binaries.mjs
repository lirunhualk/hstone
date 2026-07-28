import { execFileSync } from "node:child_process";

const tracked = execFileSync(
  "git",
  ["ls-files", "--", "public/card-art"],
  { encoding: "utf8" },
)
  .split(/\r?\n/u)
  .filter(Boolean);

if (tracked.length > 0) {
  console.error("Blizzard card-art binaries must remain local and untracked:");
  for (const file of tracked) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log("Card-art guard passed: no cached image binaries are tracked.");
}
