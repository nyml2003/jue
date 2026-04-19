export const enum BindingOpcode {
  TEXT = 0,
  ATTR = 1,
  PROP = 2,
  STYLE = 3,
  CLASS_TOGGLE = 4,
  EVENT = 5,
  REGION_SWITCH = 6,
  KEYED_LIST = 7,
  CHANNEL_DISPATCH = 8,
  RESOURCE_COMMIT = 9
}

export const enum RegionType {
  CONDITIONAL = 0,
  KEYED_LIST = 1,
  NESTED_BLOCK = 2,
  VIRTUAL_LIST = 3
}

export const enum RegionLifecycle {
  UNINITIALIZED = 0,
  INACTIVE = 1,
  ACTIVE = 2,
  UPDATING = 3,
  DISPOSING = 4,
  DISPOSED = 5
}

export const enum Lane {
  SYNC_INPUT = 0,
  VISIBLE_UPDATE = 1,
  DEFERRED = 2,
  BACKGROUND = 3
}

export const enum ResourceStatus {
  IDLE = 0,
  PENDING = 1,
  READY = 2,
  ERROR = 3
}

export const INVALID_INDEX = 0xffffffff;
export const INVALID_STATE = -1;

export const LANE_COUNT = 4;
