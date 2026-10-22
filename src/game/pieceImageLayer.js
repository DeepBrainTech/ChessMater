const CHESS_IMAGE = /\/piece-(?:dark-king|king|queen|rook|bishop|knight|pawn)\.svg(?:[?#]|$)/;

// Keep the engine's drawing coordinates and transforms, but render chess art as
// image elements. Board tiles and effects continue to use the canvas.
export function installPieceImageLayer(game) {
  const { canvas, ctx, lifecycle } = game;
  const doc = canvas.ownerDocument;
  const layer = doc.createElement('div');
  layer.className = 'game-piece-image-layer';
  layer.setAttribute('aria-hidden', 'true');
  const scene = doc.createElement('div');
  scene.className = 'game-piece-image-scene';
  layer.appendChild(scene);
  canvas.parentElement.appendChild(lifecycle.trackNode(layer));
  const sprites = [];
  let cursor = 0, last = null;
  const setStyle = (element, value) => { if (element.style.cssText !== value) element.style.cssText = value; };
  const createSprite = () => {
    const node = doc.createElement('span');
    node.className = 'game-piece-sprite';
    const image = doc.createElement('img');
    image.alt = ''; image.draggable = false;
    node.appendChild(image);
    const badges = {};
    for (const name of ['lock', 'counter', 'castle']) {
      const badge = doc.createElement('span');
      badge.className = `game-piece-badge game-piece-badge--${name}`;
      badge.hidden = true;
      node.appendChild(badge); badges[name] = badge;
    }
    scene.appendChild(node);
    return { node, image, badges, bounds: null };
  };
  const api = {
    beginFrame() {
      cursor = 0; last = null;
      sprites.forEach(sprite => { sprite.node.hidden = true; });
      const sx = canvas.clientWidth / canvas.width, sy = canvas.clientHeight / canvas.height;
      setStyle(layer, `left: ${canvas.offsetLeft}px; top: ${canvas.offsetTop}px; width: ${canvas.clientWidth}px; height: ${canvas.clientHeight}px;`);
      setStyle(scene, `width: ${canvas.width}px; height: ${canvas.height}px; transform: scale(${sx}, ${sy});`);
    },
    draw(image, x, y, width, height) {
      const sprite = sprites[cursor] || (sprites[cursor] = createSprite());
      cursor++; last = sprite;
      const { a, b, c, d, e, f } = ctx.getTransform();
      const tx = a * x + c * y + e, ty = b * x + d * y + f;
      setStyle(sprite.node, `width: ${width}px; height: ${height}px; transform: matrix(${a}, ${b}, ${c}, ${d}, ${tx}, ${ty}); opacity: ${ctx.globalAlpha};`);
      if (sprite.image.src !== image.src) sprite.image.src = image.src;
      sprite.image.style.filter = ctx.filter || 'none';
      Object.values(sprite.badges).forEach(badge => { badge.hidden = true; });
      sprite.node.hidden = false;
      sprite.bounds = { x: tx, y: ty, width, height };
    },
    decorateGoal(locked, counter) {
      if (!last) return;
      const { lock, counter: badge } = last.badges;
      lock.hidden = !locked; lock.textContent = '🔒';
      badge.hidden = counter == null; badge.textContent = counter == null ? '' : String(counter);
      badge.className = `game-piece-badge game-piece-badge--counter${locked ? ' game-piece-badge--top' : ''}${counter <= 3 ? ' game-piece-badge--urgent' : ''}`;
    },
    decorateCastle() {
      if (!last) return;
      last.badges.castle.hidden = false; last.badges.castle.textContent = '✓';
    },
    occludeRect(x, y, width, height) {
      for (const sprite of sprites) {
        const r = sprite.bounds;
        if (r && r.x < x + width && r.x + r.width > x && r.y < y + height && r.y + r.height > y) sprite.node.hidden = true;
      }
    },
  };
  const drawImage = ctx.drawImage;
  lifecycle.setHandler(ctx, 'drawImage', function (image, ...args) {
    if (image?.src && CHESS_IMAGE.test(image.src) && args.length === 4) {
      api.draw(image, ...args);
      return;
    }
    return drawImage.call(this, image, ...args);
  });
  game.pieceImageLayer = api;
  return api;
}
