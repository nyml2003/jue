export declare const Show: "Show";
export declare const List: "List";
export declare const VirtualList: "VirtualList";
export declare const Portal: "Portal";
export declare const Boundary: "Boundary";
export type StructurePrimitiveName = typeof Show | typeof List | typeof VirtualList | typeof Portal | typeof Boundary;
export interface PrimitiveSupport {
    readonly implemented: boolean;
    readonly phase: "phase-2" | "phase-3";
    readonly notes: string;
}
export declare const PRIMITIVE_SUPPORT: Readonly<Record<StructurePrimitiveName, PrimitiveSupport>>;
export declare function listStructurePrimitives(): readonly StructurePrimitiveName[];
export declare function isStructurePrimitiveName(value: string): value is StructurePrimitiveName;
export declare function getPrimitiveSupport(name: StructurePrimitiveName): PrimitiveSupport;
//# sourceMappingURL=index.d.ts.map