import { createHash } from "node:crypto";

/**
 * A versioned prompt. `hash` covers both the system text and the source of the
 * build function, so any template edit changes the hash without a manual bump.
 * Safe because the backend is plain `tsc` output (no bundler/minifier).
 */
export interface PromptDescriptor<A extends unknown[] = unknown[]> {
  id: string;
  version: string;
  system: string;
  build: (...args: A) => string;
  hash: string;
}

const registry = new Map<string, PromptDescriptor>();

export function definePrompt<A extends unknown[]>(spec: {
  id: string;
  version: string;
  system: string;
  build: (...args: A) => string;
}): PromptDescriptor<A> {
  if (registry.has(spec.id)) throw new Error(`Duplicate prompt id: ${spec.id}`);
  const hash = createHash("sha256").update(spec.system).update("\n---\n").update(spec.build.toString()).digest("hex");
  const descriptor: PromptDescriptor<A> = { ...spec, hash };
  registry.set(spec.id, descriptor as PromptDescriptor);
  return descriptor;
}

export function getPrompt(id: string): PromptDescriptor | undefined {
  return registry.get(id);
}

/** `{ id: "version@hash" }` for every registered prompt — asserted against a checked-in snapshot. */
export function promptRegistrySnapshot(): Record<string, string> {
  return Object.fromEntries(
    [...registry.values()].sort((a, b) => a.id.localeCompare(b.id)).map((p) => [p.id, `${p.version}@${p.hash}`])
  );
}
