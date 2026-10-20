import { durabilityChecks } from "./durability-checks.mjs";
import { runPolish } from "./polish-runner.mjs";
await runPolish(durabilityChecks, "durability-v60-runner.json");
