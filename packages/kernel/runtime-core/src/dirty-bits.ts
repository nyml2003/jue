import { err, ok, type Result } from "@jue/shared";

export interface DirtyBitset {
  readonly size: number;
  readonly words: Uint32Array;
}

export interface DirtyBitError {
  readonly code: string;
  readonly message: string;
}

/**
 * 为指定槽位数分配独立的 dirty bitset。
 *
 * @description
 * 这是运行时最基础的脏标记结构。调度器、binding flush 和 signal 写入
 * 都依赖它在 O(1) 时间内表达“某个 slot 是否已经在本批次里脏了”。
 *
 * @param size 要跟踪的槽位总数。
 * @returns 由新 `Uint32Array` 支撑的 bitset。
 */
export function createDirtyBitset(size: number): DirtyBitset {
  return {
    size,
    words: new Uint32Array(Math.ceil(size / 32))
  };
}

/**
 * 基于已有字缓冲区创建 dirty bitset 视图。
 *
 * @description
 * 这个函数不分配新存储，只是给现有 `Uint32Array` 套一层带 `size`
 * 语义的访问视图，适合把 block 内部平铺存储暴露给上层工具函数。
 *
 * @param size 这段缓冲区表示的逻辑槽位数。
 * @param words 存储 dirty 标记的底层字数组。
 * @returns 共享传入存储的 bitset 视图。
 */
export function createDirtyBitsetView(size: number, words: Uint32Array): DirtyBitset {
  return {
    size,
    words
  };
}

/**
 * 把一个槽位标记为 dirty。
 *
 * @description
 * 返回值不是“写入是否成功”，而是“这个槽位是不是第一次被置脏”。
 * 调度器正是用这个布尔值来做同批次去重。
 *
 * @param bitset 要写入的 dirty bitset。
 * @param slot 要置位的槽位索引。
 * @returns 这次调用是否把槽位从 clean 改成了 dirty。
 */
export function markDirty(bitset: DirtyBitset, slot: number): Result<boolean, DirtyBitError> {
  const range = validateRange(bitset, slot);

  if (!range.ok) {
    return range;
  }

  const wordIndex = slot >>> 5;
  const bitMask = 1 << (slot & 31);
  const previous = bitset.words[wordIndex] ?? 0;

  bitset.words[wordIndex] = previous | bitMask;
  return ok((previous & bitMask) === 0);
}

/**
 * 检查一个槽位当前是否为 dirty。
 *
 * @description
 * 这个查询不会改变 bitset 状态，主要用于 flush、调试和一致性校验路径。
 *
 * @param bitset 要读取的 dirty bitset。
 * @param slot 要检查的槽位索引。
 * @returns 槽位是否为 dirty。
 */
export function isDirty(bitset: DirtyBitset, slot: number): Result<boolean, DirtyBitError> {
  const range = validateRange(bitset, slot);

  if (!range.ok) {
    return range;
  }

  const wordIndex = slot >>> 5;
  const bitMask = 1 << (slot & 31);
  return ok(((bitset.words[wordIndex] ?? 0) & bitMask) !== 0);
}

/**
 * 清除一个槽位的 dirty 标记。
 *
 * @description
 * 一般只在对应工作已经真正执行成功后调用。这样 flush 失败时，
 * 脏位仍然保留，下一轮还有机会重试。
 *
 * @param bitset 要写入的 dirty bitset。
 * @param slot 要清除的槽位索引。
 * @returns 槽位合法时返回成功。
 */
export function clearDirty(bitset: DirtyBitset, slot: number): Result<void, DirtyBitError> {
  const range = validateRange(bitset, slot);

  if (!range.ok) {
    return range;
  }

  const wordIndex = slot >>> 5;
  const bitMask = 1 << (slot & 31);
  bitset.words[wordIndex] = (bitset.words[wordIndex] ?? 0) & ~bitMask;
  return ok(undefined);
}

/**
 * 把整个 bitset 重置为 clean。
 *
 * @description
 * 这个操作会直接把所有字清零，适合批次结束后的整体回收，
 * 不适合在仍然依赖部分脏位信息的中间阶段调用。
 *
 * @param bitset 要原地清空的 dirty bitset。
 */
export function resetDirtyBitset(bitset: DirtyBitset): void {
  bitset.words.fill(0);
}

/**
 * 校验槽位索引是否落在 bitset 的可访问范围内。
 *
 * @param bitset 正在访问的 dirty bitset。
 * @param slot 要校验的槽位索引。
 * @returns 槽位在范围内时返回成功。
 */
function validateRange(bitset: DirtyBitset, slot: number): Result<void, DirtyBitError> {
  if (slot < 0 || slot >= bitset.size) {
    return err({
      code: "DIRTY_SLOT_OUT_OF_RANGE",
      message: `Dirty bit slot ${slot} is out of range for size ${bitset.size}.`
    });
  }

  return ok(undefined);
}
