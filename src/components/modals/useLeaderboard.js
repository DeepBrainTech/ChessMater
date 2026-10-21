import { useEffect, useRef, useState } from 'react';
import { session } from '../../services/session.js';
import { fetchLeaderboard } from '../../services/leaderboard.js';

export function useLeaderboard(open, mode, level) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef(null);
  const pending = useRef(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    request.current = controller;
    pending.current = true;
    setLoading(true);
    setBusy(false);
    setError('');
    setPageError('');
    (async () => {
      try {
        await session.authReady;
        if (controller.signal.aborted) return;
        if (!session.cmUser) throw new Error('Please sign in from the portal to view the leaderboard.');
        const data = await fetchLeaderboard(mode, level, controller.signal);
        if (!controller.signal.aborted) setResult({ ...data, ranking_mode: mode, top_entries: data.entries.filter(entry => entry.rank <= 3) });
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) { pending.current = false; setLoading(false); }
      }
    })();
    return () => controller.abort();
  }, [open, mode, level, retry]);

  const loadPage = async (options, direction = 'replace') => {
    const controller = request.current;
    if (!controller || controller.signal.aborted || pending.current) return null;
    pending.current = true;
    setBusy(true);
    setPageError('');
    try {
      const data = await fetchLeaderboard(mode, level, controller.signal, options);
      if (controller.signal.aborted) return null;
      setResult(previous => {
        const top_entries = data.entries.some(entry => entry.rank === 1)
          ? data.entries.filter(entry => entry.rank <= 3) : previous.top_entries;
        if (direction === 'replace') return { ...data, ranking_mode: mode, top_entries };
        const entries = [...new Map([...previous.entries, ...data.entries].map(entry => [entry.user_id, entry])).values()]
          .sort((a, b) => a.rank - b.rank);
        return { ...data, ranking_mode: mode, entries, top_entries,
          start_rank: Math.min(previous.start_rank, data.start_rank),
          next_rank: direction === 'append' ? data.next_rank : previous.next_rank,
          previous_rank: direction === 'prepend' ? data.previous_rank : previous.previous_rank };
      });
      return data;
    } catch (err) {
      if (!controller.signal.aborted) setPageError(err.message);
      return null;
    } finally {
      if (!controller.signal.aborted) { pending.current = false; setBusy(false); }
    }
  };
  return { result, loading, error, pageError, busy: busy || loading, loadPage, isPending: () => pending.current,
    retry: () => setRetry(value => value + 1) };
}
