export function initializeEditor(game) {
  /** Level editor interactions and export, using explicit engine state. */
  (function () {
    if (!game.CM_EDITOR_PAGE) return;
    const puzzleNumberInput = document.getElementById("puzzleNumber");
    const saveNotice = document.getElementById("saveNotice");
    if (puzzleNumberInput) {
      game.lifecycle.listen(puzzleNumberInput, "input", e => {
        e.target.value = e.target.value.replace(/\D/g, "");
      });
    }

    /** Last level name from Load / Import; used when puzzle # box is empty or non-Puzzle N. */
    let editorFallbackLevelName = null;
    function getExportLevelName() {
      const raw = puzzleNumberInput && puzzleNumberInput.value ? puzzleNumberInput.value.trim() : "";
      const digits = raw.replace(/\D/g, "");
      if (digits) return `Puzzle ${digits}`;
      if (editorFallbackLevelName) return editorFallbackLevelName;
      return "chess_puzzle";
    }
    const editorUndoStack = [];
    const MAX_EDITOR_UNDO = 80;
    /** Snapshot taken when leaving Edit for Play test; restored when returning to Edit. */
    let playTestBaseline = null;
    let movingPlatformSettingsConfirmed = false;
    let horizontalMovingPlatformSettingsConfirmed = false;
    function setMovingPlatformSettingsConfirmed(confirmed) {
      movingPlatformSettingsConfirmed = !!confirmed;
      if (typeof game.drawBoard === "function") game.drawBoard();
    }
    function setHorizontalMovingPlatformSettingsConfirmed(confirmed) {
      horizontalMovingPlatformSettingsConfirmed = !!confirmed;
      if (typeof game.drawBoard === "function") game.drawBoard();
    }
    function getLaserDirectionFromCellOffset(localX, localY) {
      const edgeZone = Math.max(10, game.TILE_SIZE * 0.24);
      const distances = [{
        direction: "up",
        distance: localY
      }, {
        direction: "down",
        distance: game.TILE_SIZE - localY
      }, {
        direction: "left",
        distance: localX
      }, {
        direction: "right",
        distance: game.TILE_SIZE - localX
      }].sort((a, b) => a.distance - b.distance);
      return distances[0].distance <= edgeZone ? distances[0].direction : null;
    }
    function getSelectedLaserFireEverySteps() {
      const input = document.getElementById("laserFireEverySteps");
      const value = input ? input.value : undefined;
      if (typeof game.normalizeLaserFireEverySteps === "function") {
        return game.normalizeLaserFireEverySteps(value);
      }
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? Math.max(2, Math.min(99, parsed)) : 2;
    }
    function toggleLaserBlockDirection(row, col, localX, localY) {
      const direction = getLaserDirectionFromCellOffset(localX, localY);
      const laser = game.laserBlocks.find(item => item.row === row && item.col === col);
      if (!laser) return;
      const fallbackDirections = typeof game.DEFAULT_LASER_DIRECTIONS !== "undefined" ? game.DEFAULT_LASER_DIRECTIONS : ["up", "down", "left", "right"];
      const directions = Array.isArray(laser.directions) ? laser.directions.slice() : fallbackDirections.slice();
      const index = directions.indexOf(direction);
      const fireEverySteps = getSelectedLaserFireEverySteps();
      pushEditorUndoCheckpoint();
      laser.fireEverySteps = fireEverySteps;
      if (!direction) {
        game.updateStatus(`Laser at (${row}, ${col}) will fire every ${fireEverySteps} moves.`);
        if (typeof game.drawBoard === "function") game.drawBoard();
        return;
      }
      if (index === -1) {
        directions.push(direction);
      } else {
        directions.splice(index, 1);
      }
      laser.directions = directions;
      game.updateStatus(`${direction} laser ${index === -1 ? "enabled" : "disabled"} at (${row}, ${col}); fires every ${fireEverySteps} moves.`);
      if (typeof game.drawBoard === "function") game.drawBoard();
    }
    function cloneEditorState() {
      return {
        board: game.board.map(row => row.slice()),
        players: JSON.parse(JSON.stringify(game.players)),
        goal: game.goal ? JSON.parse(JSON.stringify(game.goal)) : null,
        objectives: JSON.parse(JSON.stringify(game.objectives)),
        objectivesCompleted: game.objectivesCompleted,
        totalObjectives: game.totalObjectives,
        targetPieces: JSON.parse(JSON.stringify(game.targetPieces)),
        targetPiecesCaptured: game.targetPiecesCaptured,
        totalTargetPieces: game.totalTargetPieces,
        bombs: JSON.parse(JSON.stringify(game.bombs)),
        laserBlocks: JSON.parse(JSON.stringify(game.laserBlocks)),
        ducks: JSON.parse(JSON.stringify(game.ducks)),
        movingPlatforms: JSON.parse(JSON.stringify(game.movingPlatforms)),
        teleportBlocks: JSON.parse(JSON.stringify(game.teleportBlocks)),
        phaseBlockStates: JSON.parse(JSON.stringify(game.phaseBlockStates)),
        fogEnabled: game.fogEnabled
      };
    }
    function pushEditorUndoCheckpoint() {
      if (game.mode !== "edit") return;
      editorUndoStack.push(cloneEditorState());
      if (editorUndoStack.length > MAX_EDITOR_UNDO) editorUndoStack.shift();
      updateEditorUndoButton();
    }
    function restoreEditorState(s) {
      game.board = s.board.map(row => row.slice());
      game.players = JSON.parse(JSON.stringify(s.players));
      game.goal = s.goal ? JSON.parse(JSON.stringify(s.goal)) : null;
      game.objectives = JSON.parse(JSON.stringify(s.objectives));
      game.objectivesCompleted = s.objectivesCompleted;
      game.totalObjectives = s.totalObjectives;
      game.targetPieces = JSON.parse(JSON.stringify(s.targetPieces || []));
      game.targetPiecesCaptured = s.targetPiecesCaptured || game.targetPieces.filter(piece => piece.captured).length;
      game.totalTargetPieces = s.totalTargetPieces || game.targetPieces.length;
      game.bombs = JSON.parse(JSON.stringify(s.bombs));
      game.laserBlocks = JSON.parse(JSON.stringify(s.laserBlocks || []));
      game.ducks = JSON.parse(JSON.stringify(s.ducks || []));
      game.movingPlatforms = JSON.parse(JSON.stringify(s.movingPlatforms || []));
      game.teleportBlocks = JSON.parse(JSON.stringify(s.teleportBlocks));
      game.phaseBlockStates = JSON.parse(JSON.stringify(s.phaseBlockStates));
      game.gameWon = false;
      game.selectedPlayerIndex = -1;
      game.showTransformerMenu = false;
      game.transformerPosition = null;
      game.transformerPlayerIndex = -1;
      game.explodingPlayers = [];
      game.fallingPieces = [];
      game.visitedSquares.forEach(row => row.fill(false));
      for (const p of game.players) {
        if (p.row >= 0 && p.row < game.ROWS && p.col >= 0 && p.col < game.COLS) {
          game.visitedSquares[p.row][p.col] = true;
        }
      }
      if (s.fogEnabled !== undefined) {
        game.fogEnabled = s.fogEnabled;
        const fogToggleBtn = document.getElementById("levelFogToggle");
        if (fogToggleBtn) fogToggleBtn.checked = game.fogEnabled;
      }
      game.updatePlayerCount();
      game.updateObjectiveCount();
      game.updateTargetPieceCount();
    }
    function updateEditorUndoButton() {
      const btn = document.getElementById("editorUndoBtn");
      if (btn) btn.disabled = editorUndoStack.length === 0 || game.mode !== "edit";
    }
    function undoEditorLastEdit() {
      if (game.mode !== "edit") {
        game.updateStatus("Switch to Edit mode to undo editor steps.");
        return;
      }
      if (editorUndoStack.length === 0) {
        game.updateStatus("Nothing to undo.");
        return;
      }
      const prev = editorUndoStack.pop();
      restoreEditorState(prev);
      updateEditorUndoButton();
      game.updateStatus("Undid last edit.");
    }
    function eraseBoard() {
      editorFallbackLevelName = null;
      playTestBaseline = null;
      pushEditorUndoCheckpoint();
      game.board = Array.from({
        length: game.ROWS
      }, () => Array(game.COLS).fill(game.CELL_TYPES.EMPTY));
      game.players = [];
      game.bombs = [];
      game.laserBlocks = [];
      game.targetPieces = [];
      game.targetPiecesCaptured = 0;
      game.totalTargetPieces = 0;
      game.ducks = [];
      game.movingPlatforms = [];
      game.goal = null;
      game.objectives = [];
      game.objectivesCompleted = 0;
      game.totalObjectives = 0;
      game.gameWon = false;
      game.fogEnabled = false;
      const fogToggleBtn = document.getElementById("levelFogToggle");
      if (fogToggleBtn) fogToggleBtn.checked = false;
      const blockTipEl = document.getElementById("editorBlockTip");
      if (blockTipEl) blockTipEl.value = "";
      game.selectedPlayerIndex = -1;
      game.resetPhaseBlocks();
      game.showTransformerMenu = false;
      game.transformerPosition = null;
      game.transformerPlayerIndex = -1;
      game.visitedSquares.forEach(row => row.fill(false));
      game.updatePlayerCount();
      game.updateObjectiveCount();
      game.updateTargetPieceCount();
      game.updateStatus(`Board cleared! Size: ${game.ROWS}x${game.COLS}`);
      updateEditorUndoButton();
    }
    function buildPuzzleExportObject() {
      if (game.players.length === 0) {
        game.updateStatus("Please add at least one player before saving");
        return null;
      }
      if (!game.goal) {
        game.updateStatus("Please add a goal before saving");
        return null;
      }
      const puzzleName = getExportLevelName();
      const blockTipEl = document.getElementById("editorBlockTip");
      const blockTip = blockTipEl ? blockTipEl.value.trim() : "";
      const obj = {
        version: "1.3",
        name: puzzleName,
        rows: game.ROWS,
        cols: game.COLS,
        board: game.board,
        players: game.players,
        goal: game.goal,
        objectives: game.objectives,
        targetPieces: game.targetPieces,
        bombs: game.bombs,
        laserBlocks: game.laserBlocks,
        ducks: game.ducks,
        movingPlatforms: game.movingPlatforms,
        fog: game.fogEnabled,
        createdAt: new Date().toISOString()
      };
      if (blockTip) obj.blockTip = blockTip;
      return obj;
    }

    /** Match levels.js style: only each board row is one line; other fields stay pretty-printed. */
    function prettyExportKeyValue(k, v, comma) {
      const json = JSON.stringify(v, null, 2);
      const lines = json.split("\n");
      const keyPrefix = `  ${JSON.stringify(k)}: `;
      if (lines.length === 1) {
        return keyPrefix + lines[0] + comma;
      }
      const first = keyPrefix + lines[0];
      const middle = lines.slice(1, -1).map(ln => `  ${ln}`);
      const last = `  ${lines[lines.length - 1]}${comma}`;
      return [first, ...middle, last].join("\n");
    }
    function stringifyPuzzleDataForExport(puzzleData) {
      const keys = Object.keys(puzzleData);
      const parts = ["{"];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = puzzleData[k];
        const comma = i < keys.length - 1 ? "," : "";
        if (k === "board" && Array.isArray(v)) {
          if (v.length === 0) {
            parts.push(`  "board": []${comma}`);
          } else {
            const rows = v.map((row, r) => {
              const rowComma = r < v.length - 1 ? "," : "";
              return `    [${row.join(", ")}]${rowComma}`;
            }).join("\n");
            parts.push(`  "board": [\n${rows}\n  ]${comma}`);
          }
        } else {
          parts.push(prettyExportKeyValue(k, v, comma));
        }
      }
      parts.push("}");
      return parts.join("\n");
    }
    function formatPuzzleEntryForLevelsJs(puzzleData) {
      const json = stringifyPuzzleDataForExport(puzzleData);
      return json.split("\n").map(line => "    " + line).join("\n") + ",";
    }
    function copyPuzzleEntryForLevelsJs() {
      const puzzleData = buildPuzzleExportObject();
      if (!puzzleData) return;
      const text = formatPuzzleEntryForLevelsJs(puzzleData);
      const msg = "Copied to clipboard. Paste into the levels array in src/game/levels.js before ]; keep commas between entries.";
      const done = () => {
        game.updateStatus(msg);
        const sn = document.getElementById("saveNotice");
        const editorBanner = document.getElementById("editorStatusBanner");
        if (sn && !editorBanner) {
          sn.textContent = msg;
          sn.style.display = "block";
          game.lifecycle.setTimeout(() => {
            sn.style.display = "none";
          }, 5000);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {
          try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand("copy");
            ta.remove();
            done();
          } catch (_) {
            game.updateStatus("Copy failed. Use Download JSON instead.");
          }
        });
      } else {
        game.updateStatus("Clipboard not available. Use Download JSON instead.");
      }
    }
    function saveLevelToFolder() {
      const puzzleData = buildPuzzleExportObject();
      if (!puzzleData) return;
      const jsonString = stringifyPuzzleDataForExport(puzzleData);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      const safeFile = puzzleData.name.replace(/\s+/g, "_");
      downloadAnchorNode.setAttribute("download", `${safeFile}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      if (saveNotice) {
        saveNotice.style.display = "block";
        game.lifecycle.setTimeout(() => {
          saveNotice.style.display = "none";
        }, 3000);
      }
      game.updateStatus(`Downloaded "${puzzleData.name}.json". Keep as backup or use Load selected level / Import JSON.`);
    }
    function applyLoadedLevelToEditorForm(puzzleData) {
      const name = puzzleData && puzzleData.name ? String(puzzleData.name).trim() : "";
      editorFallbackLevelName = name || null;
      const m = /^Puzzle\s+(\d+)$/i.exec(name);
      if (m && puzzleNumberInput) {
        puzzleNumberInput.value = m[1];
      }
      const blockTipEl = document.getElementById("editorBlockTip");
      if (blockTipEl) {
        blockTipEl.value = puzzleData && puzzleData.blockTip != null ? String(puzzleData.blockTip) : "";
      }
    }
    function loadLevelIntoEditor(puzzleData) {
      if (!puzzleData) return;
      playTestBaseline = null;
      editorUndoStack.length = 0;
      updateEditorUndoButton();
      const clone = JSON.parse(JSON.stringify(puzzleData));
      game.loadPuzzle(clone);
      applyLoadedLevelToEditorForm(clone);
      if (typeof game.LEVELS !== "undefined" && Array.isArray(game.LEVELS)) {
        const idx = game.LEVELS.findIndex(l => l && l.name === clone.name);
        if (idx >= 0) game.currentLevelIndex = idx;
      }
      const sel = document.getElementById("editorLevelsSelect");
      if (sel && typeof game.LEVELS !== "undefined" && Array.isArray(game.LEVELS)) {
        const idx = game.LEVELS.findIndex(l => l && l.name === clone.name);
        if (idx >= 0) sel.value = String(idx);
      }
      const modeSelect = document.getElementById("modeSelect");
      if (modeSelect) {
        modeSelect.value = "edit";
        modeSelect.dispatchEvent(new Event("change"));
      }
    }
    function populateEditorLevelsSelect() {
      const sel = document.getElementById("editorLevelsSelect");
      if (!sel) return;
      sel.innerHTML = "";
      if (typeof game.LEVELS === "undefined" || !Array.isArray(game.LEVELS) || game.LEVELS.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "(levels.js not loaded or empty)";
        sel.appendChild(opt);
        sel.disabled = true;
        return;
      }
      sel.disabled = false;
      game.LEVELS.forEach((lvl, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = lvl && lvl.name ? `${i + 1}. ${lvl.name}` : `Level ${i + 1}`;
        sel.appendChild(opt);
      });
    }
    function setupLevelLoadingUI() {
      populateEditorLevelsSelect();
      const loadFromJsBtn = document.getElementById("editorLoadLevelsBtn");
      const sel = document.getElementById("editorLevelsSelect");
      if (loadFromJsBtn && sel) {
        game.lifecycle.listen(loadFromJsBtn, "click", () => {
          if (typeof game.LEVELS === "undefined" || !Array.isArray(game.LEVELS) || game.LEVELS.length === 0) {
            game.updateStatus("LEVELS is empty. Check that levels module loaded.");
            return;
          }
          const idx = parseInt(sel.value, 10);
          if (!Number.isFinite(idx) || idx < 0 || idx >= game.LEVELS.length) {
            game.updateStatus("Pick a level from the list.");
            return;
          }
          loadLevelIntoEditor(game.LEVELS[idx]);
          game.updateStatus(`Loaded "${game.LEVELS[idx].name || "level " + (idx + 1)}" from levels.js (Edit mode).`);
        });
      }
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json";
      fileInput.style.display = "none";
      document.body.appendChild(game.lifecycle.trackNode(fileInput));
      game.lifecycle.listen(fileInput, "change", event => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        game.lifecycle.setHandler(reader, "onload", e => {
          try {
            const puzzleData = JSON.parse(e.target.result);
            loadLevelIntoEditor(puzzleData);
            game.updateStatus(`Loaded JSON file: ${puzzleData.name || file.name}`);
          } catch (error) {
            game.updateStatus("Error parsing puzzle file: " + error.message);
          }
        });
        reader.readAsText(file);
        fileInput.value = "";
      });
      const jsonBtn = document.getElementById("editorLoadJsonBtn");
      if (jsonBtn) {
        game.lifecycle.listen(jsonBtn, "click", () => fileInput.click());
      }
    }

    /** Canvas edit-mode cell placement (called by the engine input handler). */
    function cmEditorOnEditCell(row, col, localX = game.TILE_SIZE / 2, localY = game.TILE_SIZE / 2) {
      if (game.editMode === "block") {
        pushEditorUndoCheckpoint();
        game.board[row][col] = game.CELL_TYPES.SOLID_BLOCK;
        game.removeLaserBlockAt(row, col);
        game.removeTargetPieceAt(row, col);
        game.updateStatus(`Solid block placed at (${row}, ${col})`);
      } else if (game.editMode === "laser_block") {
        if (game.isLaserBlockAt(row, col)) {
          toggleLaserBlockDirection(row, col, localX, localY);
          return;
        }
        if (game.board[row][col] !== game.CELL_TYPES.EMPTY && game.board[row][col] !== game.CELL_TYPES.SOLID_BLOCK) {
          game.updateStatus("Laser block can only be placed on an empty cell or solid block.");
          return;
        }
        pushEditorUndoCheckpoint();
        game.board[row][col] = game.CELL_TYPES.SOLID_BLOCK;
        game.removeTargetPieceAt(row, col);
        const fireEverySteps = getSelectedLaserFireEverySteps();
        game.addLaserBlock(row, col, undefined, fireEverySteps);
        game.updateStatus(`Laser block placed at (${row}, ${col}); fires every ${fireEverySteps} moves. Click its edges to toggle lasers.`);
      } else if (game.editMode === "phase_block") {
        pushEditorUndoCheckpoint();
        game.board[row][col] = game.CELL_TYPES.PHASE_BLOCK;
        game.removeLaserBlockAt(row, col);
        game.removeTargetPieceAt(row, col);
        game.updateStatus(`Phase-through block placed at (${row}, ${col})`);
      } else if (game.editMode === "transformer") {
        pushEditorUndoCheckpoint();
        game.board[row][col] = game.CELL_TYPES.TRANSFORMER;
        game.removeLaserBlockAt(row, col);
        game.removeTargetPieceAt(row, col);
        game.updateStatus(`Transformer block placed at (${row}, ${col})`);
      } else if (game.editMode === "teleport") {
        pushEditorUndoCheckpoint();
        game.board[row][col] = game.CELL_TYPES.TELEPORT;
        game.removeLaserBlockAt(row, col);
        game.removeTargetPieceAt(row, col);
        if (!game.teleportBlocks.some(tp => tp.row === row && tp.col === col)) {
          game.teleportBlocks.push({
            row,
            col
          });
        }
        game.updateStatus(`Teleport block placed at (${row}, ${col})`);
      } else if (game.editMode === "objective") {
        const existingObjective = game.objectives.find(obj => obj.row === row && obj.col === col);
        if (!existingObjective) {
          pushEditorUndoCheckpoint();
          game.board[row][col] = game.CELL_TYPES.OBJECTIVE;
          game.removeLaserBlockAt(row, col);
          game.removeTargetPieceAt(row, col);
          game.objectives.push({
            row,
            col,
            completed: false
          });
          game.totalObjectives = game.objectives.length;
          game.updateObjectiveCount();
          game.updateStatus(`Objective placed at (${row}, ${col}). Total: ${game.totalObjectives}`);
        } else {
          game.updateStatus("Objective already exists at this position");
        }
      } else if (game.editMode === "black_target") {
        if (game.board[row][col] === game.CELL_TYPES.EMPTY) {
          pushEditorUndoCheckpoint();
          const pieceSelect = document.getElementById("blackTargetPieceType");
          const pieceType = pieceSelect ? pieceSelect.value : "rook";
          game.board[row][col] = game.CELL_TYPES.BLACK_TARGET_PIECE;
          game.targetPieces.push({
            row,
            col,
            pieceType,
            captured: false
          });
          game.totalTargetPieces = game.targetPieces.length;
          game.targetPiecesCaptured = game.targetPieces.filter(piece => piece.captured).length;
          game.updateTargetPieceCount();
          game.updateStatus(`Black ${pieceType} target placed at (${row}, ${col}). Total: ${game.totalTargetPieces}`);
        } else {
          game.updateStatus("Cannot place black target piece on occupied cell");
        }
      } else if (game.editMode === "erase") {
        pushEditorUndoCheckpoint();
        game.board[row][col] = game.CELL_TYPES.EMPTY;
        const teleportIndex = game.teleportBlocks.findIndex(tp => tp.row === row && tp.col === col);
        if (teleportIndex !== -1) {
          game.teleportBlocks.splice(teleportIndex, 1);
        }
        const playerIndex = game.getPlayerAt(row, col);
        if (playerIndex !== -1) {
          game.players.splice(playerIndex, 1);
          game.updatePlayerCount();
        }
        const bombIndex = game.bombs.findIndex(b => b.row === row && b.col === col);
        if (bombIndex !== -1) {
          game.bombs.splice(bombIndex, 1);
        }
        game.removeLaserBlockAt(row, col);
        game.removeTargetPieceAt(row, col);
        const duckIndex = game.ducks.findIndex(duck => duck.row === row && duck.col === col);
        if (duckIndex !== -1) {
          game.ducks.splice(duckIndex, 1);
        }
        const platformIndex = game.movingPlatforms.findIndex(platform => platform.row === row && platform.col === col);
        if (platformIndex !== -1) {
          game.movingPlatforms.splice(platformIndex, 1);
        }
        if (game.goal && game.goal.row === row && game.goal.col === col) {
          game.goal = null;
        }
        const objectiveIndex = game.objectives.findIndex(obj => obj.row === row && obj.col === col);
        if (objectiveIndex !== -1) {
          game.objectives.splice(objectiveIndex, 1);
          game.totalObjectives = game.objectives.length;
          game.objectivesCompleted = game.objectives.filter(obj => obj.completed).length;
          game.updateObjectiveCount();
        }
        game.updateStatus(`Cell cleared at (${row}, ${col})`);
      } else if (game.editMode === "player_boom_right" || game.editMode === "player_boom_left") {
        if (game.board[row][col] === game.CELL_TYPES.EMPTY) {
          pushEditorUndoCheckpoint();
          const type = game.editMode.slice("player_".length);
          game.board[row][col] = game.CELL_TYPES.BOMB;
          game.removeLaserBlockAt(row, col);
          game.removeTargetPieceAt(row, col);
          game.bombs.push({
            row,
            col,
            type,
            rowDirection: 1,
            colDirection: type === "boom_left" ? -1 : 1
          });
          game.updateStatus(`${type === "boom_left" ? "Boom Left" : "Boom Right"} placed at (${row}, ${col})`);
        } else {
          game.updateStatus("Cannot place boom on occupied cell");
        }
      } else if (game.editMode.startsWith("player_")) {
        pushEditorUndoCheckpoint();
        const piece = game.editMode.slice("player_".length);
        game.board[row][col] = game.CELL_TYPES.PLAYER;
        game.removeLaserBlockAt(row, col);
        game.removeTargetPieceAt(row, col);
        game.players.push({
          row,
          col,
          pieceType: piece,
          hasMoved: false
        });
        game.updatePlayerCount();
        game.updateStatus(`${piece.charAt(0).toUpperCase() + piece.slice(1)} placed at (${row}, ${col}). Total: ${game.players.length}`);
        if (game.gravityEnabled) {
          game.applyGravity();
        }
      } else if (game.editMode.startsWith("teleport_")) {
        const color = game.editMode.split("_")[1];
        const teleportType = {
          purple: game.CELL_TYPES.TELEPORT_PURPLE,
          green: game.CELL_TYPES.TELEPORT_GREEN,
          blue: game.CELL_TYPES.TELEPORT_BLUE,
          orange: game.CELL_TYPES.TELEPORT_ORANGE
        }[color];
        if (teleportType) {
          pushEditorUndoCheckpoint();
          game.board[row][col] = teleportType;
          game.removeLaserBlockAt(row, col);
          game.removeTargetPieceAt(row, col);
          if (!game.teleportBlocks.some(tp => tp.row === row && tp.col === col)) {
            game.teleportBlocks.push({
              row,
              col,
              type: teleportType
            });
          }
          game.updateStatus(`${color.charAt(0).toUpperCase() + color.slice(1)} teleporter placed at (${row}, ${col})`);
        }
      } else if (game.editMode === "goal") {
        pushEditorUndoCheckpoint();
        if (game.goal) game.board[game.goal.row][game.goal.col] = game.CELL_TYPES.EMPTY;
        game.board[row][col] = game.CELL_TYPES.GOAL;
        game.removeLaserBlockAt(row, col);
        game.removeTargetPieceAt(row, col);
        game.goal = {
          row,
          col
        };
        game.updateStatus(`Goal placed at (${row}, ${col})`);
        if (game.gravityEnabled) {
          game.applyGravity();
        }
      } else if (game.editMode === "counter_goal") {
        pushEditorUndoCheckpoint();
        if (game.goal) game.board[game.goal.row][game.goal.col] = game.CELL_TYPES.EMPTY;
        const cgInput = document.getElementById("counterGoalMoves");
        const moves = cgInput ? parseInt(cgInput.value, 10) || 5 : 5;
        game.board[row][col] = game.CELL_TYPES.COUNTER_GOAL;
        game.removeLaserBlockAt(row, col);
        game.removeTargetPieceAt(row, col);
        game.goal = {
          row,
          col,
          type: "counter",
          counter: moves
        };
        game.updateStatus(`Counter Goal placed at (${row}, ${col}) with ${game.goal.counter} moves`);
      } else if (game.editMode === "bomb") {
        if (game.board[row][col] === game.CELL_TYPES.EMPTY) {
          pushEditorUndoCheckpoint();
          game.board[row][col] = game.CELL_TYPES.BOMB;
          game.removeLaserBlockAt(row, col);
          game.removeTargetPieceAt(row, col);
          game.bombs.push({
            row,
            col,
            direction: 1
          });
          game.updateStatus(`Bomb placed at (${row}, ${col})`);
        } else {
          game.updateStatus("Cannot place bomb on occupied cell");
        }
      } else if (game.editMode === "duck_right" || game.editMode === "duck_left") {
        pushEditorUndoCheckpoint();
        const direction = game.editMode === "duck_left" ? -1 : 1;
        game.ducks = game.ducks.filter(duck => duck.row !== row);
        const firstCol = direction === 1 ? 0 : game.COLS - 1;
        let placedCount = 0;
        for (let duckCol = firstCol; duckCol >= 0 && duckCol < game.COLS; duckCol += direction * game.DUCK_COLUMN_STEP) {
          if (game.board[row][duckCol] !== game.CELL_TYPES.EMPTY) continue;
          game.ducks.push({
            row,
            col: duckCol,
            direction
          });
          placedCount++;
        }
        game.updateStatus(`${placedCount} ducks placed on row ${row}, moving ${direction === 1 ? "right" : "left"}, with three empty cells between them.`);
      } else if (game.editMode === "moving_platform") {
        if (!movingPlatformSettingsConfirmed) {
          game.updateStatus("Confirm the platform range before placing.");
          return;
        }
        if (game.board[row][col] === game.CELL_TYPES.EMPTY) {
          const bottomInput = document.getElementById("platformBottomLevel");
          const topInput = document.getElementById("platformTopLevel");
          const bottomLevel = game.clampPlatformLevel(bottomInput ? bottomInput.value : 0);
          const topLevel = game.clampPlatformLevel(topInput ? topInput.value : game.ROWS - 1);
          const minLevel = Math.min(bottomLevel, topLevel);
          const maxLevel = Math.max(bottomLevel, topLevel);
          const currentLevel = game.rowToPlatformLevel(row);
          if (currentLevel < minLevel || currentLevel > maxLevel) {
            game.updateStatus(`Platform must be placed between level ${minLevel} and ${maxLevel}`);
            return;
          }
          pushEditorUndoCheckpoint();
          game.board[row][col] = game.CELL_TYPES.MOVING_PLATFORM;
          game.removeLaserBlockAt(row, col);
          game.removeTargetPieceAt(row, col);
          game.movingPlatforms.push({
            row,
            col,
            minLevel,
            maxLevel,
            currentLevel,
            direction: 1
          });
          game.updateStatus(`Moving platform placed at level ${currentLevel} (${row}, ${col})`);
        } else {
          game.updateStatus("Cannot place moving platform on occupied cell");
        }
      } else if (game.editMode === "moving_platform_horizontal") {
        if (!horizontalMovingPlatformSettingsConfirmed) {
          game.updateStatus("Confirm the horizontal platform range before placing.");
          return;
        }
        if (game.board[row][col] === game.CELL_TYPES.EMPTY) {
          const leftInput = document.getElementById("platformLeftCol");
          const rightInput = document.getElementById("platformRightCol");
          const leftCol = game.clampPlatformCol(leftInput ? leftInput.value : 0);
          const rightCol = game.clampPlatformCol(rightInput ? rightInput.value : game.COLS - 1);
          const minCol = Math.min(leftCol, rightCol);
          const maxCol = Math.max(leftCol, rightCol);
          const currentCol = game.clampPlatformCol(col);
          if (currentCol < minCol || currentCol > maxCol) {
            game.updateStatus(`Platform must be placed between column ${minCol} and ${maxCol}`);
            return;
          }
          pushEditorUndoCheckpoint();
          game.board[row][col] = game.CELL_TYPES.MOVING_PLATFORM;
          game.removeLaserBlockAt(row, col);
          game.removeTargetPieceAt(row, col);
          game.movingPlatforms.push({
            axis: "horizontal",
            row,
            col,
            minCol,
            maxCol,
            currentCol,
            direction: 1
          });
          game.updateStatus(`Horizontal moving platform placed at column ${currentCol} (${row}, ${col})`);
        } else {
          game.updateStatus("Cannot place horizontal moving platform on occupied cell");
        }
      }
    }
    game.cmEditorOnEditCell = cmEditorOnEditCell;
    const modeSelect = document.getElementById("modeSelect");
    if (modeSelect) {
      game.lifecycle.listen(modeSelect, "change", e => {
        const newMode = e.target.value;
        const prevMode = game.mode;
        let skipResetPhaseBlocks = false;
        if (newMode === "play" && prevMode === "edit") {
          playTestBaseline = cloneEditorState();
          const tipEl = document.getElementById("editorBlockTip");
          playTestBaseline._editorBlockTip = tipEl ? tipEl.value : "";
        }
        if (newMode === "edit" && prevMode === "play" && playTestBaseline) {
          restoreEditorState(playTestBaseline);
          const tipEl = document.getElementById("editorBlockTip");
          if (tipEl && playTestBaseline._editorBlockTip !== undefined) {
            tipEl.value = playTestBaseline._editorBlockTip;
          }
          if (typeof game.cmResetEditorAfterPlaytest === "function") {
            game.cmResetEditorAfterPlaytest();
          }
          playTestBaseline = null;
          skipResetPhaseBlocks = true;
          if (typeof game.drawBoard === "function") game.drawBoard();
        }
        game.mode = newMode;
        game.selectedPlayerIndex = -1;
        game.updateStatus(`Mode: ${game.mode === "edit" ? "Edit Mode" : "Play Mode"}`);
        if (game.mode === "edit" && !skipResetPhaseBlocks) {
          game.resetPhaseBlocks();
        }
        game.showTransformerMenu = false;
        game.transformerPosition = null;
        game.transformerPlayerIndex = -1;
        if (game.mode === "play" && game.gravityEnabled && !game.gameWon) {
          game.applyGravity();
        }
        updateEditorUndoButton();
      });
    }
    const editModeSelect = document.getElementById("editMode");
    if (editModeSelect) {
      game.lifecycle.listen(editModeSelect, "change", e => {
        game.editMode = e.target.value;
        const cg = document.getElementById("counterGoalSettings");
        if (cg) cg.style.display = game.editMode === "counter_goal" ? "block" : "none";
        const blackTargetSettings = document.getElementById("blackTargetSettings");
        if (blackTargetSettings) blackTargetSettings.style.display = game.editMode === "black_target" ? "block" : "none";
        const laserSettings = document.getElementById("laserSettings");
        if (laserSettings) laserSettings.style.display = game.editMode === "laser_block" ? "block" : "none";
        const platformSettings = document.getElementById("movingPlatformSettings");
        if (platformSettings) platformSettings.style.display = game.editMode === "moving_platform" ? "block" : "none";
        const horizontalPlatformSettings = document.getElementById("horizontalMovingPlatformSettings");
        if (horizontalPlatformSettings) horizontalPlatformSettings.style.display = game.editMode === "moving_platform_horizontal" ? "block" : "none";
        setMovingPlatformSettingsConfirmed(game.editMode !== "moving_platform");
        setHorizontalMovingPlatformSettingsConfirmed(game.editMode !== "moving_platform_horizontal");
      });
      game.editMode = editModeSelect.value;
      const blackTargetSettings = document.getElementById("blackTargetSettings");
      if (blackTargetSettings) blackTargetSettings.style.display = game.editMode === "black_target" ? "block" : "none";
      const laserSettings = document.getElementById("laserSettings");
      if (laserSettings) laserSettings.style.display = game.editMode === "laser_block" ? "block" : "none";
      const platformSettings = document.getElementById("movingPlatformSettings");
      if (platformSettings) platformSettings.style.display = game.editMode === "moving_platform" ? "block" : "none";
      const horizontalPlatformSettings = document.getElementById("horizontalMovingPlatformSettings");
      if (horizontalPlatformSettings) horizontalPlatformSettings.style.display = game.editMode === "moving_platform_horizontal" ? "block" : "none";
      setMovingPlatformSettingsConfirmed(game.editMode !== "moving_platform");
      setHorizontalMovingPlatformSettingsConfirmed(game.editMode !== "moving_platform_horizontal");
    }
    const confirmPlatformSettingsBtn = document.getElementById("confirmPlatformSettings");
    if (confirmPlatformSettingsBtn) {
      game.lifecycle.listen(confirmPlatformSettingsBtn, "click", () => {
        setMovingPlatformSettingsConfirmed(true);
        game.updateStatus("Moving platform range confirmed. Click an empty cell to place it.");
      });
    }
    const confirmHorizontalPlatformSettingsBtn = document.getElementById("confirmHorizontalPlatformSettings");
    if (confirmHorizontalPlatformSettingsBtn) {
      game.lifecycle.listen(confirmHorizontalPlatformSettingsBtn, "click", () => {
        setHorizontalMovingPlatformSettingsConfirmed(true);
        game.updateStatus("Horizontal moving platform range confirmed. Click an empty cell to place it.");
      });
    }
    ["platformBottomLevel", "platformTopLevel"].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        game.lifecycle.listen(input, "input", () => {
          if (game.editMode === "moving_platform") {
            setMovingPlatformSettingsConfirmed(false);
            game.updateStatus("Platform range changed. Confirm it before placing.");
          }
        });
      }
    });
    ["platformLeftCol", "platformRightCol"].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        game.lifecycle.listen(input, "input", () => {
          if (game.editMode === "moving_platform_horizontal") {
            setHorizontalMovingPlatformSettingsConfirmed(false);
            game.updateStatus("Horizontal platform range changed. Confirm it before placing.");
          }
        });
      }
    });
    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
      game.lifecycle.listen(downloadBtn, "click", () => {
        saveLevelToFolder();
      });
    }
    const eraseBoardBtn = document.getElementById("eraseBoardBtn");
    if (eraseBoardBtn) {
      game.lifecycle.listen(eraseBoardBtn, "click", () => {
        if (confirm("Erase the entire board? You can use Undo last edit once to restore if you change your mind.")) {
          eraseBoard();
        }
      });
    }
    const editorUndoBtn = document.getElementById("editorUndoBtn");
    if (editorUndoBtn) {
      game.lifecycle.listen(editorUndoBtn, "click", undoEditorLastEdit);
      editorUndoBtn.disabled = true;
    }
    const copyLevelsJsBtn = document.getElementById("copyLevelsJsBtn");
    if (copyLevelsJsBtn) {
      game.lifecycle.listen(copyLevelsJsBtn, "click", copyPuzzleEntryForLevelsJs);
    }
    setupLevelLoadingUI();
  })();
}
