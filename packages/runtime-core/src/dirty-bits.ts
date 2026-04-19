import { err, ok, type Result } from "@jue/shared";

export interface DirtyBitset {
  readonly size: number;
  readonly words: Uint32Array;
}

export interface DirtyBitError {
  readonly code: string;
  readonly message: string;
}

export function createDirtyBitset(size: number): DirtyBitset {
  return {
    size,
    words: new Uint32Array(Math.ceil(size / 32))
  };
}

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

export function isDirty(bitset: DirtyBitset, slot: number): Result<boolean, DirtyBitError> {
  const range = validateRange(bitset, slot);

  if (!range.ok) {
    return range;
  }

  const wordIndex = slot >>> 5;
  const bitMask = 1 << (slot & 31);
  return ok(((bitset.words[wordIndex] ?? 0) & bitMask) !== 0);
}

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

export function resetDirtyBitset(bitset: DirtyBitset): void {
  bitset.words.fill(0);
}

function validateRange(bitset: DirtyBitset, slot: number): Result<void, DirtyBitError> {
  if (slot < 0 || slot >= bitset.size) {
    return err({
      code: "DIRTY_SLOT_OUT_OF_RANGE",
      message: `Dirty bit slot ${slot} is out of range for size ${bitset.size}.`
    });
  }

  return ok(undefined);
}
