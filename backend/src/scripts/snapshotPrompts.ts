import { writeFileSync } from "node:fs";
import path from "node:path";
import { promptRegistrySnapshot } from "../ai/prompts/registry";
import "../ai/prompts/index";

/**
 * Regenerates tests/promptHashes.snapshot.json. The test suite asserts the
 * live registry equals this file, so any prompt edit must be committed with
 * a refreshed snapshot (and, by convention, a version bump).
 *   npm run prompts:snapshot
 */
const target = path.resolve(process.cwd(), "tests/promptHashes.snapshot.json");
writeFileSync(target, `${JSON.stringify(promptRegistrySnapshot(), null, 2)}\n`);
console.log(`wrote ${target}`);
