/**
 * Reassembles newline-delimited JSON from a child process's stdout.
 *
 * A pipe splits wherever the OS feels like it, not on line boundaries: one
 * `data` event can carry half a message, three messages, or two and a half.
 * Parsing each chunk as it arrives therefore produces silent, intermittent loss
 * — the kind that works on a developer machine and drops one measurement in
 * twenty on a kiosk, where the messages are longer and the process is busier.
 *
 * Kept apart from the supervisor that uses it (ZedSidecarManager) because it is
 * the one genuinely error-prone piece of that file, and because a module with no
 * imports at all can be exercised by `npm run height:selftest` without Electron.
 */
export class NdjsonBuffer {
  private partial = '';

  /**
   * Feed one chunk; get back whatever COMPLETE lines it finished.
   *
   * Blank lines are dropped. The trailing fragment is retained for the next
   * chunk — which is the entire point — so a caller must not treat "no lines
   * returned" as "nothing arrived".
   */
  push(chunk: string): string[] {
    this.partial += chunk;
    const parts = this.partial.split('\n');
    // The last element is either a partial line or '' (when the chunk ended on
    // a newline). Both are correct to carry forward.
    this.partial = parts.pop() ?? '';
    return parts.map((line) => line.trim()).filter((line) => line.length > 0);
  }

  /**
   * Discard the pending fragment.
   *
   * Called when the child dies: whatever it was midway through writing is
   * incomplete by definition, and holding it would prepend garbage to the first
   * line the REPLACEMENT process sends.
   */
  reset(): void {
    this.partial = '';
  }
}
