import { useEffect, useRef, useState } from 'react';
import { MOVE_MARKER } from '../../game/moveMarker.js';
import { assets } from '../../game/assets.js';
import { guideLanding, guideMoves, guideRising, guideScene } from './guideBoard.js';
import { game } from '../../game/runtime.js';
import { createLifecycle } from '../../game/lifecycle.js';
import GameButton from '../GameButton.jsx';

export const GUIDE_PIECES = [
  { type: 'king', label: 'King', description: 'The king moves one square in any direction.' },
  { type: 'queen', label: 'Queen', description: 'The queen moves straight or diagonally, any distance.' },
  { type: 'rook', label: 'Rook', description: 'The rook moves horizontally or vertically, any distance.' },
  { type: 'bishop', label: 'Bishop', description: 'The bishop moves diagonally, any distance.' },
  { type: 'knight', label: 'Knight', description: 'The knight jumps in an L shape, over other pieces and blocks.' },
  { type: 'pawn', label: 'Pawn', description: 'The pawn moves upward: one square, or two on its first move. It captures targets diagonally.' },
];
export default function GuideBoard({ page, pieceType, onPieceChange, description, onPrevious, onNext }) {
  const scene = guideScene(pieceType, page);
  const [player, setPlayer] = useState(() => scene.player);
  const [antigravity, setAntigravity] = useState(false);
  const [selected, setSelected] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [motion, setMotion] = useState('idle');
  const [previewMove, setPreviewMove] = useState(null);
  const moving = useRef(false);
  const motionTimers = useRef([]);
  const boardRef = useRef(null);
  const { platforms, goal } = scene;
  const moves = guideMoves(player, platforms, goal);
  const previewIndex = previewMove ?? moves.find(index => guideLanding({ ...player, row: Math.floor(index / 5), col: index % 5 }, platforms, goal).row > Math.floor(index / 5));
  const landingPreview = page === 1 && previewIndex != null
    ? guideLanding({ ...player, row: Math.floor(previewIndex / 5), col: previewIndex % 5 }, platforms, goal) : null;
  const current = GUIDE_PIECES.find(piece => piece.type === pieceType);
  const clearMotion = () => {
    motionTimers.current.forEach(clearTimeout);
    motionTimers.current = [];
    moving.current = false;
  };
  useEffect(() => () => clearMotion(), []);
  useEffect(() => {
    if (!completed) return;
    const lifecycle = createLifecycle();
    setCelebrating(true);
    game.triggerConfetti?.({ target: boardRef.current, lifecycle, count: 40, duration: 1500,
      contained: true, silent: true, origin: { x: (goal % 5 + .5) / 5, y: (Math.floor(goal / 5) + .5) / 4 } });
    lifecycle.setTimeout(() => setCelebrating(false), 2200);
    return () => lifecycle.dispose();
  }, [completed]);
  const performMove = (destination, reselect, { physicsOnly = false, gravity = !antigravity } = {}) => {
    clearMotion();
    const landing = gravity ? guideLanding(destination, platforms, goal) : guideRising(destination, platforms, goal);
    const physicsMotion = gravity ? 'falling' : 'rising';
    const reachedGoal = page === 3 && (destination.row * 5 + destination.col === goal || landing.row * 5 + landing.col === goal);
    const finish = () => {
      setPlayer(landing); setMotion('idle'); setPreviewMove(null); moving.current = false; setSelected(reselect && !reachedGoal);
      if (reachedGoal) setCompleted(true);
      motionTimers.current = [];
    };
    if (physicsOnly && landing.row === destination.row) { finish(); return; }
    moving.current = true;
    if (physicsOnly) {
      setMotion(physicsMotion); setSelected(false); setPlayer(landing);
      motionTimers.current.push(setTimeout(finish, 450));
      return;
    }
    setMotion('moving'); setSelected(false); setPlayer(destination);
    motionTimers.current.push(setTimeout(() => {
      if (landing.row === destination.row) { finish(); return; }
      setMotion(physicsMotion); setPlayer(landing);
      motionTimers.current.push(setTimeout(finish, 450));
    }, 450));
  };

  const moveTo = index => {
    if (moving.current || completed) return;
    if (index === player.row * 5 + player.col) { setSelected(value => !value); return; }
    if (!selected || !moves.includes(index)) return;
    setPreviewMove(index);
    performMove({ ...player, row: Math.floor(index / 5), col: index % 5, hasMoved: true }, true);
  };
  const toggleAntigravity = () => {
    if (moving.current) return;
    const next = !antigravity;
    setAntigravity(next);
    performMove(player, true, { physicsOnly: true, gravity: !next });
  };

  return <div className="beginner-demo">
    <div className="beginner-piece-picker" role="group" aria-label="Choose a chess piece">
      {GUIDE_PIECES.map(piece => <button type="button" key={piece.type} data-piece={piece.type}
        aria-pressed={pieceType === piece.type} aria-label={piece.label} onClick={() => onPieceChange(piece.type)}>
        <img src={`/assets/images/game/piece-${piece.type}.svg`} alt="" /><span>{piece.label}</span>
      </button>)}
    </div>
    <div className="beginner-board-stage">
    <button type="button" className="beginner-step beginner-step--previous" aria-label="Previous step" onClick={onPrevious}>
      <img src="/assets/images/ui/guide-arrow.svg" alt="" />
    </button>
    <div ref={boardRef} className={`beginner-board beginner-board--${page}${completed ? ' beginner-board--complete' : ''}`}
      data-motion={motion} data-antigravity={antigravity} aria-busy={motion !== 'idle'}
      role="group" aria-label={page === 0 ? `${current.label} movement practice` : ['','Move a piece and watch it fall onto a platform.','Toggle Anti-Gravity and move a piece to try rising and falling.','Move onto the black king’s square to capture it.'][page]}
      style={{ '--piece-x': player.col, '--piece-y': player.row, '--guide-marker-fill': MOVE_MARKER.fill, '--guide-marker-stroke': MOVE_MARKER.stroke }}>
      {Array.from({ length: 20 }, (_, index) => {
        const here = index === player.row * 5 + player.col;
        const available = !completed && motion === 'idle' && selected && moves.includes(index);
        const content = <>
          <img src={(Math.floor(index / 5) + index % 5) % 2 ? assets.tiles.light : assets.tiles.dark} alt="" />
          {platforms.includes(index) && <img className="beginner-platform" src={assets.tiles.blockOpen} alt="" />}
          {goal === index && !completed && <img className="beginner-target-open" src="/assets/images/game/piece-dark-king.svg" alt="" />}
          {available && <span className="beginner-move-dot" />}
        </>;
        return <button key={index} type="button" className={`beginner-tile${here && selected ? ' beginner-tile--selected' : ''}`}
          data-cell={index} data-available={available} tabIndex={here || available ? 0 : -1} aria-label={`${here ? current.label : available ? 'Move to' : platforms.includes(index) ? 'Platform at' : 'Square'} row ${Math.floor(index / 5) + 1}, column ${index % 5 + 1}`}
          aria-disabled={!here && !available} onPointerEnter={() => { if (available) setPreviewMove(index); }}
          onFocus={() => { if (available) setPreviewMove(index); }} onClick={() => moveTo(index)}>{content}</button>;
      })}
      {landingPreview && <span className="beginner-landing-preview" aria-hidden="true"
        data-row={landingPreview.row} data-col={landingPreview.col}
        style={{ left: `${landingPreview.col * 20}%`, top: `${landingPreview.row * 25}%` }}>
        <img className="beginner-piece-image" src={`/assets/images/game/piece-${pieceType}.svg`} alt="" />
      </span>}
      <span className="beginner-piece" data-piece={pieceType} data-row={player.row} data-col={player.col}>
        <img className="beginner-piece-image" src={`/assets/images/game/piece-${pieceType}.svg`} alt="" />
      </span>
      {celebrating && <span className="beginner-goal-glow" style={{ left: `${goal % 5 * 20}%`, top: `${Math.floor(goal / 5) * 25}%` }} aria-hidden="true" />}
    </div>
    {page === 2 && <div className="beginner-antigravity">
      <GameButton label="Anti-Gravity" color="purple" icon="antigravity" quantity={antigravity ? 'ON' : 'OFF'}
        pressed={antigravity} disabled={motion !== 'idle'} onClick={toggleAntigravity} ariaLabel="Anti-Gravity" />
    </div>}
    <button type="button" className="beginner-step beginner-step--next" aria-label="Next step" onClick={onNext}>
      <img src="/assets/images/ui/guide-arrow.svg" alt="" />
    </button>
    </div>
    <p className={`beginner-piece-explanation${page === 2 ? ' beginner-description' : ''}${completed ? ' beginner-piece-explanation--success' : ''}`} aria-live="polite">{completed ? 'Well done! You captured the black king.' : page === 0 ? current.description : description}</p>
  </div>;
}
