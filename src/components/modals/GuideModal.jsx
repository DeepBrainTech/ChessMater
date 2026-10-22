import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hideModal, showModal } from '../../game/modalFocus.js';
import GuideBoard from './GuideBoard.jsx';

const PAGES = [
  { title: 'Learn the Moves' },
  { title: 'Watch Your Landing', description: 'After moving, your piece falls until it lands on a platform.' },
  { title: 'Use Antigravity', description: "Use Anti-Gravity to float upward. You'll need it to beat certain levels!" },
  { title: 'Capture the Black King', description: 'Move onto the black king’s square to capture it.' },
];

function GuideAction({ label, variant, onClick, id }) {
  return <button id={id} className={`start-screen-action start-screen-action--${variant}`} type="button" onClick={onClick}>
    <span className="start-screen-action-frame" aria-hidden="true"><img src={`/assets/images/home/button-${variant}.webp`} alt="" /></span>
    <span className="start-screen-action-label">{label}</span>
  </button>;
}

export default function GuideModal() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pieceSelection, setPieceSelection] = useState({ type: 'king', version: 0 });
  const modalRef = useRef(null);
  const firstDotRef = useRef(null);
  const touchStart = useRef(null);
  const arrowFocus = useRef(null);
  const changePage = delta => setPage(previous => (previous + delta + PAGES.length) % PAGES.length);
  const navigateWithArrow = delta => { arrowFocus.current = delta > 0 ? 'next' : 'previous'; changePage(delta); };

  useEffect(() => {
    const button = document.getElementById('instructionsButton');
    const onOpen = () => { setPage(0); setPieceSelection({ type: 'king', version: 0 }); setOpen(true); };
    button?.addEventListener('click', onOpen);
    return () => button?.removeEventListener('click', onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    const returnFocus = modal.ownerDocument.activeElement;
    showModal(modal);
    firstDotRef.current?.focus({ preventScroll: true });
    return () => {
      hideModal(modal);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [open]);

  useLayoutEffect(() => {
    const modal = modalRef.current;
    if (open && arrowFocus.current) {
      modal?.querySelector(`.beginner-step--${arrowFocus.current}`)?.focus({ preventScroll: true });
      arrowFocus.current = null;
      return;
    }
    if (open && modal?.classList.contains('active') && !modal.contains(document.activeElement)) {
      modal.querySelector('.beginner-piece-picker [aria-pressed="true"]')?.focus({ preventScroll: true });
    }
  }, [open, page, pieceSelection.version]);

  const onKeyDown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); event.stopPropagation(); changePage(event.key === 'ArrowRight' ? 1 : -1);
    }
    if (event.key === 'Tab') {
      const buttons = [...modalRef.current.querySelectorAll('button')].filter(button => button.tabIndex >= 0 && !button.closest('[inert]'));
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  const startGame = () => {
    setOpen(false);
    document.getElementById('startButton')?.click();
  };

  return <div ref={modalRef} id="guideModal" className="leaderboard-modal beginner-screen" role="dialog" aria-modal="true"
    aria-label="Beginner Guide" aria-hidden="true" onKeyDown={onKeyDown}>
    {open && <div className="guide-content beginner-content" onTouchStart={event => {
      const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY };
    }} onTouchEnd={event => {
      const start = touchStart.current; touchStart.current = null;
      if (!start) return;
      const dx = event.changedTouches[0].clientX - start.x;
      const dy = event.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) changePage(dx < 0 ? 1 : -1);
    }} onTouchCancel={() => { touchStart.current = null; }}>
      <h2 className="beginner-title" aria-live="polite">
        <span className="beginner-step-number">{page + 1}</span>
        <span>{PAGES[page].title}</span>
      </h2>
      <GuideBoard key={`${page}-${pieceSelection.version}`} page={page} pieceType={pieceSelection.type}
        onPrevious={() => navigateWithArrow(-1)} onNext={() => navigateWithArrow(1)}
        onPieceChange={type => setPieceSelection(previous => ({ type, version: previous.version + 1 }))}
        description={PAGES[page].description} />
      <div className="beginner-caption">
        <div className="beginner-pagination" role="group" aria-label="Guide pages">
          {PAGES.map((data, index) => <button key={data.title} ref={index === 0 ? firstDotRef : undefined} type="button"
            aria-label={`Page ${index + 1}: ${data.title}`} aria-current={index === page ? 'step' : undefined} onClick={() => setPage(index)}><span /></button>)}
        </div>
      </div>
      <div className="beginner-actions">
        <GuideAction label="Start Game" variant="start" onClick={startGame} />
        <GuideAction id="closeGuideModal" label="Back to Menu" variant="guide" onClick={() => setOpen(false)} />
      </div>
    </div>}
  </div>;
}
