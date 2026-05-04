import { err, ok, type Result } from "@jue/shared";
import { mountCompiledModule } from "@jue/web";

import {
  blueprint,
  createRuntime,
  initialSignalValues,
  signalCount,
  signalSlots
} from "./generated/page.generated";

export interface StreamLabError {
  readonly code: string;
  readonly message: string;
}

export interface MountedStreamLab {
  recordWin(): void;
  recordFollowUp(): void;
  recordRisk(): void;
  readSnapshot(): {
    readonly momentum: string;
    readonly wins: string;
    readonly followUps: string;
    readonly risks: string;
    readonly headline: string;
    readonly recommendation: string;
  };
  dispose(): Result<void, StreamLabError>;
}

export function mountStreamLab(root: Node): Result<MountedStreamLab, StreamLabError> {
  const runtime = createRuntime();
  const mountedResult = mountCompiledModule({
    root,
    blueprint,
    signalCount,
    initialSignalValues,
    signalSlots,
    configureSignalRuntime: runtime.configureSignalRuntime,
    handlers: runtime.handlers
  });
  if (!mountedResult.ok) {
    return err(mountedResult.error);
  }

  const clickButton = (selector: string) => {
    if (!(root instanceof Element)) {
      return;
    }

    root.querySelector<HTMLButtonElement>(selector)?.click();
  };

  return ok({
    recordWin() {
      clickButton(".stream-lab-button--win");
    },
    recordFollowUp() {
      clickButton(".stream-lab-button--follow-up");
    },
    recordRisk() {
      clickButton(".stream-lab-button--risk");
    },
    readSnapshot() {
      if (!(root instanceof Element)) {
        return {
          momentum: "",
          wins: "",
          followUps: "",
          risks: "",
          headline: "",
          recommendation: ""
        };
      }

      return {
        momentum: root.querySelector(".stream-lab-metric-value--momentum")?.textContent ?? "",
        wins: root.querySelector(".stream-lab-metric-value--wins")?.textContent ?? "",
        followUps: root.querySelector(".stream-lab-metric-value--follow-ups")?.textContent ?? "",
        risks: root.querySelector(".stream-lab-metric-value--risks")?.textContent ?? "",
        headline: root.querySelector(".stream-lab-status")?.textContent ?? "",
        recommendation: root.querySelector(".stream-lab-recommendation")?.textContent ?? ""
      };
    },
    dispose() {
      return mountedResult.value.mountedTree.dispose();
    }
  });
}
