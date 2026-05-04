import { err, ok, type Result } from "@jue/shared";
import { mountCompiledModule } from "@jue/web";

import {
  blueprint,
  createRuntime,
  initialSignalValues,
  signalCount,
  signalSlots
} from "./generated/page.generated";

export interface RouterQueryLabError {
  readonly code: string;
  readonly message: string;
}

export interface MountedRouterQueryLab {
  clickAlpha(): void;
  clickBravo(): void;
  clickOverview(): void;
  clickActivity(): void;
  clickReload(): void;
  clickInvalidate(): void;
  currentHref(): string;
  readVisibleText(): string;
  dispose(): Result<void, RouterQueryLabError>;
}

export function mountRouterQueryLab(root: Node): Result<MountedRouterQueryLab, RouterQueryLabError> {
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

  const clickButtonByText = (text: string) => {
    if (!(root instanceof Element)) {
      return;
    }

    Array.from(root.querySelectorAll<HTMLButtonElement>("button"))
      .find(button => button.textContent?.includes(text))
      ?.click();
  };

  return ok({
    clickAlpha() {
      clickButtonByText("Alpha checkout");
    },
    clickBravo() {
      clickButtonByText("Bravo billing");
    },
    clickOverview() {
      clickButtonByText("Overview tab");
    },
    clickActivity() {
      clickButtonByText("Activity tab");
    },
    clickReload() {
      clickButtonByText("Reload view");
    },
    clickInvalidate() {
      clickButtonByText("Invalidate cache");
    },
    currentHref() {
      if (!(root instanceof Element)) {
        return "";
      }

      return root.querySelector(".router-query-route")?.textContent ?? "";
    },
    readVisibleText() {
      return root.textContent ?? "";
    },
    dispose() {
      return mountedResult.value.mountedTree.dispose();
    }
  });
}
