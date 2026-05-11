// Submission review queue.
//
// User-visible contract (do not paraphrase, do not describe storage):
//   "Submissions go through editorial review. Accepted entries are published
//    publicly on the site."
//
// The storage mechanism is implementation detail. The v1 backend is swappable
// without changing the /submit route or user-facing copy.

export interface PendingEntry {
  id: string;
  type: 'number' | 'word';
  system: 'cultural' | 'major' | 'keypad' | 'leet';
  to: string;
  note?: string;
}

export interface ReviewQueue {
  submit(entry: PendingEntry): Promise<void>;
}

class MemoryReviewQueue implements ReviewQueue {
  async submit(_entry: PendingEntry): Promise<void> {
    // v1 backend will be wired up in a follow-up. For now this is a no-op
    // so the /submit form remains a complete UI but does not persist.
    return;
  }
}

export const reviewQueue: ReviewQueue = new MemoryReviewQueue();
