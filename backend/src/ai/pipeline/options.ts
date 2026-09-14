import { ReliabilityMode } from "../runner";

export interface PipelineOptions {
  /** `fast` (default) = one call; `verified` = k sampled calls with agreement reporting. */
  reliability?: ReliabilityMode;
}
