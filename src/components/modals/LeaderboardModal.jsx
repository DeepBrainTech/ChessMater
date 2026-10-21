import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { session } from '../../services/session.js';
import { useLeaderboard } from './useLeaderboard.js';
import { game } from '../../game/runtime.js';
import { hideModal, showModal } from '../../game/modalFocus.js';

const ASSETS = '/assets/images/leaderboard/';
const ORDINALS = ['1st', '2nd', '3rd'];
const CROWNS = ['gold', 'silver', 'bronze'];
const nameOf = entry => entry?.username || (entry?.user_id != null ? `Player ${entry.user_id}` : 'You');
const scoreOf = (entry, mode) => mode === 'level'
  ? `${entry.best_moves} ${Number(entry.best_moves) === 1 ? 'move' : 'moves'}`
  : `${entry.completed_levels} ${Number(entry.completed_levels) === 1 ? 'level' : 'levels'}`;

function PlayerAvatar({ entry }) {
  const [failedUrls, setFailedUrls] = useState([]);
  const source = [entry.avatar_url, entry.avatar_fallback_url].find(url => url && !failedUrls.includes(url));
  return source ? <img className="lb-avatar" src={source} alt="" referrerPolicy="no-referrer"
    onError={() => setFailedUrls(urls => [...urls, source])} /> : null;
}

function Podium({ entries, mode }) {
  return <div className="lb-podium" aria-label="Top three players">
    {[1, 0, 2].map(index => {
      const entry = entries[index];
      return <div className={`lb-winner lb-winner--${index + 1}`} key={index}>
        <div className="lb-winner-player">
          {entry ? <>
            <div className="lb-portrait"><PlayerAvatar entry={entry} />
              <span className="lb-crown"><img src={`${ASSETS}crown-${CROWNS[index]}.svg`} alt={`${ORDINALS[index]} place`} /></span>
            </div>
            <div className="lb-winner-details"><span className="lb-name" title={nameOf(entry)}>{nameOf(entry)}</span>
              <span className="lb-winner-score">{scoreOf(entry, mode)}</span></div>
          </> : <span className="lb-vacant">Awaiting a player</span>}
        </div>
        <div className="lb-pedestal"><span className="lb-pedestal-top"><img src={`${ASSETS}podium-top.svg`} alt="" /></span>
          <span className="lb-ordinal" aria-hidden="true">{ORDINALS[index]}</span></div>
      </div>;
    })}
  </div>;
}

function RankingRow({ entry, mode, personal = false, isMe = false }) {
  return <div data-rank={personal ? undefined : entry?.rank} tabIndex={personal ? undefined : -1} className={`lb-row${personal || isMe ? ' lb-row--me' : ''}`}>
    <span className="lb-rank">{personal ? <small>Your Rank</small> : <span className="lb-trophy"><img src={`${ASSETS}trophy.svg`} alt="" /></span>}
      <span>{entry?.rank ?? '—'}</span></span>
    <span className="lb-name" title={nameOf(entry)}>{nameOf(entry)}{isMe && !personal ? ' (You)' : ''}</span>
    <span className="lb-score">{entry ? scoreOf(entry, mode) : 'Not ranked yet'}</span>
  </div>;
}

export default function LeaderboardModal() {
  const modalRef = useRef(null);
  const tabRef = useRef(null);
  const scrollRef = useRef(null);
  const scrollTimer = useRef(null);
  const pendingPosition = useRef(null);
  const shortcutRef = useRef(null);
  const jumpingToMe = useRef(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('completed');
  const [level, setLevel] = useState(1);
  const [levelCount, setLevelCount] = useState(1);
  const { result, loading, error, pageError, busy, loadPage, isPending, retry } = useLeaderboard(open, mode, level);

  useEffect(() => {
    const button = document.getElementById('leaderboardButton');
    let disposed = false;
    const onOpen = async () => {
      await session.authReady;
      if (disposed) return;
      setLevelCount(game.LEVELS?.length || 1);
      setMode('completed');
      setOpen(true);
    };
    button?.addEventListener('click', onOpen);
    return () => { disposed = true; button?.removeEventListener('click', onOpen); };
  }, []);

  useEffect(() => {
    const modal = modalRef.current;
    if (!open) return;
    const returnFocus = modal.ownerDocument.activeElement;
    showModal(modal);
    tabRef.current?.focus({ preventScroll: true });
    return () => {
      hideModal(modal);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [open]);

  const setShortcutHidden = hidden => {
    const scroller = scrollRef.current;
    const shortcut = shortcutRef.current;
    if (!scroller || !shortcut || shortcut.hidden === hidden) return;
    const viewport = scroller.getBoundingClientRect();
    // Preserve a visible ranking row when removing or restoring the shortcut.
    const anchor = [...scroller.querySelectorAll('.lb-list > .lb-row')].find(row => {
      const bounds = row.getBoundingClientRect();
      return bounds.bottom > viewport.top && bounds.top < viewport.bottom;
    });
    const anchorTop = anchor?.getBoundingClientRect().top;
    const hadFocus = shortcut.contains(document.activeElement);
    shortcut.hidden = hidden;
    if (anchor) scroller.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
    if (hidden && hadFocus) scroller.querySelector('.lb-list > .lb-row--me')?.focus({ preventScroll: true });
  };
  const updateFade = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const viewport = scroller.getBoundingClientRect();
    const ownRow = scroller.querySelector('.lb-list > .lb-row--me')?.getBoundingClientRect();
    setShortcutHidden(jumpingToMe.current || !!(ownRow && ownRow.bottom > viewport.top + 1 && ownRow.top < viewport.bottom - 1));
    const height = scroller.querySelector('.lb-row')?.getBoundingClientRect().height || 40;
    const remaining = Math.max(0, scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop);
    const clamp = value => Math.max(0, Math.min(1, value));
    const topStrength = scroller.dataset.hasPrevious === 'true' ? 1 : scroller.scrollTop > 1 ? clamp(scroller.scrollTop / height) : 0;
    const bottomStrength = scroller.dataset.hasNext === 'true' ? 1 : remaining > 1 ? clamp(remaining / height) : 0;
    // The hint follows directions with more data, including unloaded pages.
    // Reduce its strength near a boundary instead of changing an entire row at once.
    const topSize = Math.min(height, scroller.clientHeight * .25);
    const bottomSize = Math.min(height * 2, scroller.clientHeight * .45);
    const frame = scroller.parentElement;
    frame.style.setProperty('--lb-fade-top', topStrength);
    frame.style.setProperty('--lb-fade-bottom', bottomStrength);
    frame.style.setProperty('--lb-fade-top-size', `${topSize}px`);
    frame.style.setProperty('--lb-fade-bottom-size', `${bottomSize}px`);
    scroller.dataset.fadeTop = String(topStrength > 0);
    scroller.dataset.fadeBottom = String(bottomStrength > 0);
    scroller.querySelectorAll('.lb-list > .lb-row').forEach(row => {
      row.style.removeProperty('opacity');
      row.style.removeProperty('mask-image');
    });
  };
  const revealRank = (rank, smooth = true) => {
    const scroller = scrollRef.current;
    const target = scroller?.querySelector(`[data-rank="${rank}"]`);
    if (!target) return;
    jumpingToMe.current = true;
    setShortcutHidden(true);
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      - (scroller.clientHeight - target.getBoundingClientRect().height) / 2;
    scroller.scrollTo({ top: Math.max(0, top), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
    target.focus?.({ preventScroll: true });
    scheduleScrollEnd();
  };
  useLayoutEffect(() => {
    const position = pendingPosition.current;
    if (position && scrollRef.current) {
      pendingPosition.current = null;
      if (position.rank) revealRank(position.rank, false);
      else if (position.height) scrollRef.current.scrollTop = position.top + scrollRef.current.scrollHeight - position.height;
      else scrollRef.current.scrollTop = 0;
    }
    updateFade();
    if (modalRef.current?.classList.contains('active') && !modalRef.current.contains(document.activeElement)) {
      tabRef.current?.focus({ preventScroll: true });
    }
  }, [result, loading]);
  useEffect(() => {
    pendingPosition.current = {};
    jumpingToMe.current = false;
    clearTimeout(scrollTimer.current);
    window.addEventListener('resize', updateFade);
    return () => { clearTimeout(scrollTimer.current); window.removeEventListener('resize', updateFade); };
  }, [open, mode, level]);
  const navigatePage = async (options, direction = 'replace') => {
    if (busy || isPending()) return;
    if (direction === 'replace') jumpingToMe.current = false;
    const position = direction === 'prepend' ? { height: scrollRef.current?.scrollHeight, top: scrollRef.current?.scrollTop } : direction === 'replace' ? {} : null;
    pendingPosition.current = position;
    const data = await loadPage(options, direction);
    if (!data && pendingPosition.current === position) pendingPosition.current = null;
  };
  const jumpToMe = async () => {
    const rank = result?.current_user?.rank;
    if (!rank || busy || isPending()) return;
    if (result.entries.some(entry => entry.rank === rank)) return revealRank(rank);
    const position = { rank };
    pendingPosition.current = position;
    if (!await loadPage({ aroundMe: true }) && pendingPosition.current === position) pendingPosition.current = null;
  };
  const scheduleScrollEnd = () => {
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      jumpingToMe.current = false;
      scrollRef.current?.classList.remove('lb-scroll--active');
      updateFade();
    }, 700);
  };
  const onScroll = () => {
    const scroller = scrollRef.current;
    scroller.classList.add('lb-scroll--active');
    scheduleScrollEnd();
    updateFade();
    if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80 && result?.next_rank && !pageError) {
      void navigatePage({ startRank: result.next_rank }, 'append');
    }
  };

  const onKeyDown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
    if (event.key !== 'Tab') return;
    const focusable = [...modalRef.current.querySelectorAll('button, select, [tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const entries = result?.entries || [];
  const displayMode = result?.ranking_mode ?? mode;
  return <div ref={modalRef} id="leaderboardModal" className="leaderboard-modal lb-screen" role="dialog"
    aria-modal="true" aria-label="Leaderboard" aria-hidden="true" onKeyDown={onKeyDown}>
    <button id="closeLeaderboard" className="lb-exit" type="button" aria-label="Close leaderboard" onClick={() => setOpen(false)}>
      <span className="lb-exit-art">
      <span className="lb-exit-rim"><img src={`${ASSETS}exit-rim.svg`} alt="" /></span>
      <span className="lb-exit-body"><img src={`${ASSETS}exit-body.svg`} alt="" /></span>
      <span className="lb-exit-shine"><img src={`${ASSETS}exit-shine.svg`} alt="" /></span>
      <span className="lb-exit-detail"><img src={`${ASSETS}exit-detail.svg`} alt="" /></span>
      </span>
    </button>
    <div className="lb-content">
      <div className="lb-filters">
        <div className="lb-tabs" role="group" aria-label="Ranking category">
          <button ref={tabRef} type="button" aria-pressed={mode === 'completed'} onClick={() => setMode('completed')}>Levels Completed</button>
          <button type="button" aria-pressed={mode === 'level'} onClick={() => setMode('level')}>Fewest Moves</button>
        </div>
        {mode === 'level' && <span className="lb-level-select"><select id="leaderboardModeSelect" aria-label="Select level" value={level} onChange={event => setLevel(Number(event.target.value))}>
          {Array.from({ length: levelCount }, (_, index) => <option key={index} value={index + 1}>Level {index + 1}</option>)}
        </select></span>}
      </div>
      <div className="lb-results" aria-busy={loading || busy}>
        {loading && !result ? <div className="lb-message" role="status">Loading leaderboard…</div>
          : error ? <div className="lb-message" role="alert"><p>{error}</p><button type="button" onClick={retry}>Try again</button></div>
          : <>
            {!!result?.top_entries?.length && <Podium entries={result.top_entries} mode={displayMode} />}
            <div className="lb-scroll-frame">
            <div ref={scrollRef} className="lb-scroll" tabIndex={0} role="region" aria-label="Rankings from fourth place"
              data-has-previous={!!result?.previous_rank} data-has-next={!!result?.next_rank} onScroll={onScroll}>
            {result?.previous_rank && <div className="lb-page-actions">
              <button type="button" disabled={busy} onClick={() => navigatePage({ startRank: 1 })}>Back to top</button>
              <button type="button" disabled={busy} onClick={() => navigatePage({ startRank: result.previous_rank }, 'prepend')}>Load previous rankings</button>
            </div>}
            {!entries.length && <div className="lb-message" role="status">No scores yet. Complete a level to join the leaderboard!</div>}
            <div className="lb-list">
              {entries.filter(entry => entry.rank > 3).map(entry => <RankingRow key={entry.user_id} entry={entry} mode={displayMode} isMe={String(entry.user_id) === String(result?.current_user?.user_id)} />)}
            </div>
            {pageError && <p className="lb-page-error" role="alert">{pageError}</p>}
            {result?.next_rank && <button className="lb-more" type="button" disabled={busy} onClick={() => navigatePage({ startRank: result.next_rank }, 'append')}>{busy ? 'Loading…' : 'Load more rankings'}</button>}
          </div></div>
            {result?.current_user?.rank > 9 && <button ref={shortcutRef} className="lb-personal" type="button" disabled={busy} onClick={jumpToMe} aria-label="Show rankings near your rank">
              <RankingRow entry={result.current_user} mode={displayMode} personal />
            </button>}
          </>}
      </div>
    </div>
  </div>;
}
