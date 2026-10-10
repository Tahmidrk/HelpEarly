// Durable resource revisions, not socket delivery, decide cache freshness.
export function createSynchronizer(fetchRevisions, onChange, onError = () => {}) {
  let snapshot = null, running = false, queued = false, stopped = false, forceNext = false;
  const check = async (force = false) => {
    forceNext ||= force;
    if (stopped) return;
    if (running) { queued = true; return; }
    running = true;
    try {
      const next = await fetchRevisions();
      if (stopped) return;
      const keys = new Set([...Object.keys(snapshot || {}), ...Object.keys(next)]);
      const changed = [...keys].filter(key => forceNext || !snapshot || snapshot[key] !== next[key]);
      snapshot = next; forceNext = false;
      if (changed.length) onChange(changed);
    } catch (error) { if (!stopped) onError(error); }
    finally { running = false; if (queued && !stopped) { queued = false; check(); } }
  };
  return { check, stop: () => { stopped = true; } };
}
