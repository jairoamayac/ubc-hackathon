// QuickNode Streams filter (JavaScript) for Kept. Paste the whole file into the Stream's "Modify the stream
// payload" editor. Runs on QuickNode: keeps only dispute lines written by OUR program, drops everything else.
// Works with the Solana "Programs + Logs" dataset (data: [[{ signature, slot, blockTime, logs, success }]])
// and, as a fallback, the "Block" dataset (transactions[].meta.logMessages).
// Returns null when a batch has no dispute, so the webhook only fires for real events.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function main(stream) {
  const PROGRAM = "7nqWXrf9A6WwNxDJ3x1qH6UnCJs1o7iEHtRix7mnDQt1";
  const LINE = /^Program log: KEPT:DisputeOpened challenge=([1-9A-HJ-NP-Za-km-z]{32,44}) member=([1-9A-HJ-NP-Za-km-z]{32,44}) disputer=([1-9A-HJ-NP-Za-km-z]{32,44}) reason=(\d{1,3})(?: dispute=([1-9A-HJ-NP-Za-km-z]{32,44}))?$/;
  const disputes = [];

  function scan(logs, meta) {
    // Follow the invoke/success stack so only lines printed by our program count (a lookalike program can't fake one).
    const stack = [];
    for (const line of logs) {
      let m = /^Program (\S+) invoke \[\d+\]$/.exec(line);
      if (m) { stack.push(m[1]); continue; }
      if (/^Program (\S+) (success|failed.*)$/.test(line)) { stack.pop(); continue; }
      if (stack[stack.length - 1] !== PROGRAM) continue;
      m = LINE.exec(line);
      if (m) disputes.push({ challenge: m[1], member: m[2], disputer: m[3], reason: Number(m[4]), dispute: m[5] || null, signature: meta.signature, slot: meta.slot, blockTime: meta.blockTime });
    }
  }

  function visit(node, blockTime) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const n of node) visit(n, blockTime); return; }
    // Programs + Logs shape
    if (Array.isArray(node.logs)) {
      if (node.success !== false) scan(node.logs, { signature: node.signature, slot: node.slot, blockTime: node.blockTime });
      return;
    }
    // Block shape
    if (Array.isArray(node.transactions)) {
      for (const tx of node.transactions) {
        const logs = tx && tx.meta && tx.meta.logMessages;
        if (logs && !tx.meta.err) scan(logs, { signature: tx.transaction && tx.transaction.signatures && tx.transaction.signatures[0], slot: node.parentSlot != null ? node.parentSlot + 1 : null, blockTime: node.blockTime });
      }
    }
  }

  visit(stream.data, null);
  return disputes.length ? { disputes: disputes, network: stream.metadata && stream.metadata.network } : null;
}
