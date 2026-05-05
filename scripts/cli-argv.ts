export interface PhaseInvocation {
  forwardedArgs: string[];
  phase: string | undefined;
}

export function parsePhaseInvocation(
  argv: string[],
  lifecycleEvent: string | undefined,
): PhaseInvocation {
  const [firstArg, ...restArgs] = argv;

  if (firstArg && !firstArg.startsWith("-")) {
    return {
      forwardedArgs: restArgs,
      phase: firstArg,
    };
  }

  return {
    forwardedArgs: argv,
    phase: lifecycleEvent,
  };
}
