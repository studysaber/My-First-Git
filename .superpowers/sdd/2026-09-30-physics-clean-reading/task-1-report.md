# Task 1 implementation report

Status: DONE. Scope: safe shared learning storage only. No deployment or app mutation/event-handler changes.

## Implementation

- `dist/assets/learning-storage.js` now reads the latest canonical envelope before every persistent mutation. `getItem()` also refreshes outside transactions so existing synchronous progress consumers read current data without requiring changes to `study.js`.
- The adapter exposes `refresh()` and `runExclusive(action)`. Web Locks use the existing canonical key `physics-atlas-learning-v2`; absent Web Locks invoke the callback synchronously and return its synchronous result. The methods also exist on unavailable/damaged adapters, allowing the app to use one control flow in memory mode.
- Reconciliation applies entry deltas for the v1 `progress` map and v2 `records` map. Entries unchanged locally come from the latest storage snapshot. Changed or deleted local entries are applied only when that same entry still matches the starting baseline. A conflicting entry throws a Chinese export/refresh/retry recovery error before any writes. Whole-field removals or concurrently changed unsupported payloads fail conservatively. Metadata is treated as indivisible when concurrent changes require reconciliation.
- Transactions refresh at begin, retain a separate starting snapshot, and keep draft reads isolated from refresh. Commit reconciles against that starting snapshot before the first canonical write. A failed first write changes neither persisted state nor the rollback mirror. Commit failures dispose of the draft as before; the app can reconstruct temporary stores in its existing recovery flow.
- Existing v1 rollback mirror synchronization and old-site edit recovery remain intact. Fresh malformed canonical data blocks mutation. Canonical writes retain other envelope properties. Failed secondary mirror writes leave the successful canonical commit available and flag the mirror for retry.
- `dist/assets/practice.js` exposes `refresh()` and reads latest records before get/export (`getAll`), review selection, submit, begin-attempt, and import. Saved records are validated with the existing record validator while allowing persisted question IDs and versions to remain readable independently of the current question catalog.
- Practice read/write failures keep records available in memory. A set of temporary entry deltas, including deletions from a memory-mode replace, survives later refreshes while untouched persistent entries can update from another tab. Temporary records are not silently repersisted. Existing import conflict policy remains unchanged for Task 2.

## TDD evidence

The TDD skill and its `writing-good-tests.md` reference were read before editing. Test expectations use hand-derived values and real adapters/stores over a shared Storage-compatible Map. Only the unavailable external Web Locks boundary uses a controlled callback gate.

1. Added `tests/shared-learning.test.js` before production changes. Ran `node --test tests/shared-learning.test.js` against the original implementation: **7 tests, 1 passed, 6 failed**. The required lost-answer reproduction failed with `undefined` instead of `true` after the older adapter wrote self-assessment. Other observed failures were duplicate-submit recording, stale independent entries rejected as old-site conflicts, independent transaction changes rejected, damaged canonical overwrite allowed, and absent practice refresh.
2. Added adapter refresh/lock and practice latest-import/damaged-read tests before implementation. Ran `node --test tests/shared-learning.test.js tests/learning-storage.test.js tests/practice.test.js`: **29 tests, 18 passed, 11 failed**. Missing methods and the older import replacing a newer answer were directly observed.
3. Implemented latest reads, delta reconciliation, transaction baselines, lock delegation, and temporary-record refresh. The focused suite reached **28/29**; the remaining failure identified a test-environment assumption: this Node runtime exposes native Web Locks. Corrected the fallback fixture to explicitly supply a navigator without locks. This exercises the specified unavailable-lock branch rather than assuming Node lacks locks.
4. Added two failure-path regression tests before their fixes. Ran `node --test tests/practice.test.js tests/learning-storage.test.js`: **24 tests, 22 passed, 2 failed**. A null stored record crashed `getDue()`; replacing temporary records left an undefined ghost entry on refresh. Added saved-record validation and temporary deletion handling.
5. Final focused command: `node --test tests/shared-learning.test.js tests/learning-storage.test.js tests/practice.test.js`: **31 tests passed, 0 failed**.
6. Full command: `npm test`: **178 tests passed, 0 failed**.
7. `git diff --check` completed successfully. Git emitted only existing Windows LF/CRLF conversion notices, with no whitespace errors.

## Self-review

- The required `c9-shm-concept` answer survives an older adapter updating `c9-shm` assessment, and distinct questions from older practice store instances survive together.
- Same-entry conflicts are rejected both for stale adapter sessions and transactions; transaction refresh cannot erase the starting baseline.
- Independent entries and untouched envelope fields are retained during reconciliation. Only the documented maps receive entry-level reconciliation; unsupported concurrent changes fail conservatively.
- The first canonical write is the sole transaction commit point. Mirror writes occur afterward and are best-effort, preserving existing rollback compatibility and canonical availability after mirror failure.
- Read damage and quota failure do not discard temporary evidence, do not overwrite damaged storage, and do not break review/export. Memory-mode replacement uses local deletion deltas so refresh does not resurrect removed temporary entries.
- Question/node IDs, schema versions, storage keys, due-date calculations, grading, and default import merge policy are unchanged.
- New tests exercise consumer-visible behavior through actual store instances; the lock fixture asserts delayed persistence and the callback result, rather than merely asserting a mock was called.
- All changes are confined to the two Task 1 production files, three Task 1 test files, and this report. Other agents’ `.impeccable` work is untouched.

## Integration notes and limitations

- Task 2 must wrap the entire app read/modify/write operation in `runExclusive` and handle its Promise result when Web Locks exist. Refresh/recreate progress and refresh practice inside the granted lock callback. Browser storage-event handling and import-policy updates remain Task 2 work.
- Adapter `refresh()` deliberately does not replace an active transaction draft. Reads within transactions return the draft. Failed commits clear the draft; subsequent refresh reads persistent records.
- The synchronous fallback provides latest-read and delta conflict checks but cannot provide an atomic cross-tab compare-and-swap on native localStorage. Web Locks serialize participating browser app operations; older sites and browsers without locks remain bounded by the explicit fallback contract.
- Practice submission retains the existing nonthrowing memory fallback on write failure. Imports retain their existing throwing/atomic behavior on persistent write failure. The adapter exposes Chinese conflict/damage errors to direct/transaction callers, while normal practice failure remains visible via its memory persistence state.
- No browser test was run for this storage-only task. Real two-tab browser coverage belongs to Task 2/integration, as specified by the task split.

No material unresolved concern or architecture ambiguity remains within Task 1.
