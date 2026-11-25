/**
 * Per-turn snapshots of a cloud session's /workspace (#632, /rewind). The worker takes
 * one before each turn, keyed by the sequence of the user message that starts it; the
 * server restores one on /rewind. The snapshots live in their own git directory, so the
 * repository's own history, branches and index are never touched.
 */
export const CHECKPOINT_WORKSPACE = '/workspace'

const GIT = `git -c user.name="December Agent" -c user.email="agent@trydecember.com" --git-dir="$HOME/.december/checkpoints" --work-tree=${CHECKPOINT_WORKSPACE}`

const turnRef = (sequence: number) => `refs/december/turns/${Math.trunc(sequence)}`

/** prints CHECKPOINT when the snapshot was saved */
export const buildCheckpointCommand = (sequence: number): string =>
    [
        'D="$HOME/.december/checkpoints"',
        'if [ ! -d "$D" ]; then mkdir -p "$D" && git init -q --bare "$D" && mkdir -p "$D/info" && printf "node_modules/\\n.next/\\ndist/\\n" > "$D/info/exclude"; fi',
        `${GIT} add -A . >/dev/null 2>&1`,
        `T=$(${GIT} write-tree)`,
        `C=$(${GIT} commit-tree "$T" -m "turn ${Math.trunc(sequence)}")`,
        `${GIT} update-ref ${turnRef(sequence)} "$C"`,
        'echo CHECKPOINT',
    ].join(' && ')

/**
 * Puts /workspace back to the snapshot taken before the turn: files changed since are
 * restored and files created since are removed (ignored files stay). The state before
 * the rewind is saved first as refs/december/before-rewind/<time>, so a rewind can be
 * undone by hand. Prints RESTORED, or NO_CHECKPOINT when there is no snapshot.
 */
export const buildRestoreCommand = (sequence: number): string =>
    [
        'D="$HOME/.december/checkpoints"',
        `if [ ! -d "$D" ] || ! ${GIT} rev-parse --verify -q ${turnRef(sequence)} >/dev/null; then echo NO_CHECKPOINT; exit 0; fi`,
        `${GIT} add -A . >/dev/null 2>&1`,
        `T=$(${GIT} write-tree) && C=$(${GIT} commit-tree "$T" -m "before rewind") && ${GIT} update-ref "refs/december/before-rewind/$(date +%s)" "$C"`,
        `${GIT} read-tree -u --reset ${turnRef(sequence)} && echo RESTORED`,
    ].join('; ')
