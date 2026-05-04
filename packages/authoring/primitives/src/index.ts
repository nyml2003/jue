export const Show = "Show" as const;
export const List = "List" as const;
export const VirtualList = "VirtualList" as const;
export const Portal = "Portal" as const;
export const Boundary = "Boundary" as const;

export type StructurePrimitiveName =
  | typeof Show
  | typeof List
  | typeof VirtualList
  | typeof Portal
  | typeof Boundary;

export interface PrimitiveSupport {
  readonly implemented: boolean;
  readonly phase: "phase-2" | "phase-3";
  readonly notes: string;
}

export const PRIMITIVE_SUPPORT: Readonly<Record<StructurePrimitiveName, PrimitiveSupport>> = {
  [Show]: {
    implemented: true,
    phase: "phase-2",
    notes: "Compiles to conditional regions."
  },
  [List]: {
    implemented: true,
    phase: "phase-2",
    notes: "Compiles to keyed-list regions."
  },
  [VirtualList]: {
    implemented: true,
    phase: "phase-2",
    notes: "Compiles to virtual-list regions."
  },
  [Portal]: {
    implemented: false,
    phase: "phase-3",
    notes: "Reserved primitive; host/runtime support is not active yet."
  },
  [Boundary]: {
    implemented: false,
    phase: "phase-3",
    notes: "Reserved primitive; boundary runtime is not active yet."
  }
};

export function listStructurePrimitives(): readonly StructurePrimitiveName[] {
  return [
    Show,
    List,
    VirtualList,
    Portal,
    Boundary
  ];
}

export function isStructurePrimitiveName(value: string): value is StructurePrimitiveName {
  return listStructurePrimitives().includes(value as StructurePrimitiveName);
}

export function getPrimitiveSupport(name: StructurePrimitiveName): PrimitiveSupport {
  return PRIMITIVE_SUPPORT[name];
}
