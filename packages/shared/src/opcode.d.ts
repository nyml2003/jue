export declare const BindingOpcode: {
    readonly TEXT: 0;
    readonly ATTR: 1;
    readonly PROP: 2;
    readonly STYLE: 3;
    readonly CLASS_TOGGLE: 4;
    readonly EVENT: 5;
    readonly REGION_SWITCH: 6;
    readonly KEYED_LIST: 7;
    readonly CHANNEL_DISPATCH: 8;
    readonly RESOURCE_COMMIT: 9;
};
export type BindingOpcode = (typeof BindingOpcode)[keyof typeof BindingOpcode];
export declare const RegionType: {
    readonly CONDITIONAL: 0;
    readonly KEYED_LIST: 1;
    readonly NESTED_BLOCK: 2;
    readonly VIRTUAL_LIST: 3;
};
export type RegionType = (typeof RegionType)[keyof typeof RegionType];
export declare const RegionLifecycle: {
    readonly UNINITIALIZED: 0;
    readonly INACTIVE: 1;
    readonly ACTIVE: 2;
    readonly UPDATING: 3;
    readonly DISPOSING: 4;
    readonly DISPOSED: 5;
};
export type RegionLifecycle = (typeof RegionLifecycle)[keyof typeof RegionLifecycle];
export declare const Lane: {
    readonly SYNC_INPUT: 0;
    readonly VISIBLE_UPDATE: 1;
    readonly DEFERRED: 2;
    readonly BACKGROUND: 3;
};
export type Lane = (typeof Lane)[keyof typeof Lane];
export declare const ResourceStatus: {
    readonly IDLE: 0;
    readonly PENDING: 1;
    readonly READY: 2;
    readonly ERROR: 3;
};
export type ResourceStatus = (typeof ResourceStatus)[keyof typeof ResourceStatus];
export declare const INVALID_INDEX = 4294967295;
export declare const INVALID_STATE = -1;
export declare const LANE_COUNT = 4;
//# sourceMappingURL=opcode.d.ts.map