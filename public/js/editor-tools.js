/**
 * Level editor UI and export — loaded only on editor.html (window.CM_EDITOR_PAGE === true).
 * Relies on globals from game.js (board, mode, editMode, CELL_TYPES, etc.).
 */
(function () {
  if (!window.CM_EDITOR_PAGE) return;

  const puzzleNumberInput = document.getElementById("puzzleNumber");
  const saveNotice = document.getElementById("saveNotice");

  if (puzzleNumberInput) {
    puzzleNumberInput.addEventListener("input", (e) => {
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

  function cloneEditorState() {
    return {
      board: board.map((row) => row.slice()),
      players: JSON.parse(JSON.stringify(players)),
      goal: goal ? JSON.parse(JSON.stringify(goal)) : null,
      objectives: JSON.parse(JSON.stringify(objectives)),
      objectivesCompleted,
      totalObjectives,
      bombs: JSON.parse(JSON.stringify(bombs)),
      teleportBlocks: JSON.parse(JSON.stringify(teleportBlocks)),
      phaseBlockStates: JSON.parse(JSON.stringify(phaseBlockStates)),
      fogEnabled
    };
  }

  function pushEditorUndoCheckpoint() {
    if (mode !== "edit") return;
    editorUndoStack.push(cloneEditorState());
    if (editorUndoStack.length > MAX_EDITOR_UNDO) editorUndoStack.shift();
    updateEditorUndoButton();
  }

  function restoreEditorState(s) {
    board = s.board.map((row) => row.slice());
    players = JSON.parse(JSON.stringify(s.players));
    goal = s.goal ? JSON.parse(JSON.stringify(s.goal)) : null;
    objectives = JSON.parse(JSON.stringify(s.objectives));
    objectivesCompleted = s.objectivesCompleted;
    totalObjectives = s.totalObjectives;
    bombs = JSON.parse(JSON.stringify(s.bombs));
    teleportBlocks = JSON.parse(JSON.stringify(s.teleportBlocks));
    phaseBlockStates = JSON.parse(JSON.stringify(s.phaseBlockStates));
    gameWon = false;
    selectedPlayerIndex = -1;
    showTransformerMenu = false;
    transformerPosition = null;
    transformerPlayerIndex = -1;
    explodingPlayers = [];
    fallingPieces = [];
    visitedSquares.forEach((row) => row.fill(false));
    for (const p of players) {
      if (p.row >= 0 && p.row < ROWS && p.col >= 0 && p.col < COLS) {
        visitedSquares[p.row][p.col] = true;
      }
    }
    if (s.fogEnabled !== undefined) {
      fogEnabled = s.fogEnabled;
      const fogToggleBtn = document.getElementById("levelFogToggle");
      if (fogToggleBtn) fogToggleBtn.checked = fogEnabled;
    }
    updatePlayerCount();
    updateObjectiveCount();
  }

  function updateEditorUndoButton() {
    const btn = document.getElementById("editorUndoBtn");
    if (btn) btn.disabled = editorUndoStack.length === 0 || mode !== "edit";
  }

  function undoEditorLastEdit() {
    if (mode !== "edit") {
      updateStatus("Switch to Edit mode to undo editor steps.");
      return;
    }
    if (editorUndoStack.length === 0) {
      updateStatus("Nothing to undo.");
      return;
    }
    const prev = editorUndoStack.pop();
    restoreEditorState(prev);
    updateEditorUndoButton();
    updateStatus("Undid last edit.");
  }

  function eraseBoard() {
    editorFallbackLevelName = null;
    playTestBaseline = null;
    pushEditorUndoCheckpoint();
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_TYPES.EMPTY));
    players = [];
    goal = null;
    objectives = [];
    objectivesCompleted = 0;
    totalObjectives = 0;
    gameWon = false;
    fogEnabled = false;
    const fogToggleBtn = document.getElementById("levelFogToggle");
    if (fogToggleBtn) fogToggleBtn.checked = false;
    const blockTipEl = document.getElementById("editorBlockTip");
    if (blockTipEl) blockTipEl.value = "";
    selectedPlayerIndex = -1;
    resetPhaseBlocks();
    showTransformerMenu = false;
    transformerPosition = null;
    transformerPlayerIndex = -1;
    visitedSquares.forEach((row) => row.fill(false));
    updatePlayerCount();
    updateObjectiveCount();
    updateStatus(`Board cleared! Size: ${ROWS}x${COLS}`);
    updateEditorUndoButton();
  }

  function buildPuzzleExportObject() {
    if (players.length === 0) {
      updateStatus("Please add at least one player before saving");
      return null;
    }
    if (!goal) {
      updateStatus("Please add a goal before saving");
      return null;
    }
    const puzzleName = getExportLevelName();
    const blockTipEl = document.getElementById("editorBlockTip");
    const blockTip = blockTipEl ? blockTipEl.value.trim() : "";
    const obj = {
      version: "1.3",
      name: puzzleName,
      rows: ROWS,
      cols: COLS,
      board: board,
      players: players,
      goal: goal,
      objectives: objectives,
      bombs: bombs,
      fog: fogEnabled,
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
    const middle = lines.slice(1, -1).map((ln) => `  ${ln}`);
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
          const rows = v
            .map((row, r) => {
              const rowComma = r < v.length - 1 ? "," : "";
              return `    [${row.join(", ")}]${rowComma}`;
            })
            .join("\n");
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
    return json.split("\n").map((line) => "    " + line).join("\n") + ",";
  }

  function copyPuzzleEntryForLevelsJs() {
    const puzzleData = buildPuzzleExportObject();
    if (!puzzleData) return;
    const text = formatPuzzleEntryForLevelsJs(puzzleData);
    const msg =
      "Copied to clipboard. Paste into the LEVELS array in public/js/levels.js before ]; keep commas between entries.";
    const done = () => {
      updateStatus(msg);
      const sn = document.getElementById("saveNotice");
      const editorBanner = document.getElementById("editorStatusBanner");
      if (sn && !editorBanner) {
        sn.textContent = msg;
        sn.style.display = "block";
        setTimeout(() => {
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
          updateStatus("Copy failed. Use Download JSON instead.");
        }
      });
    } else {
      updateStatus("Clipboard not available. Use Download JSON instead.");
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
      setTimeout(() => {
        saveNotice.style.display = "none";
      }, 3000);
    }

    updateStatus(`Downloaded "${puzzleData.name}.json". Keep as backup or use Load selected level / Import JSON.`);
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
      blockTipEl.value =
        puzzleData && puzzleData.blockTip != null ? String(puzzleData.blockTip) : "";
    }
  }

  function loadLevelIntoEditor(puzzleData) {
    if (!puzzleData) return;
    playTestBaseline = null;
    editorUndoStack.length = 0;
    updateEditorUndoButton();
    const clone = JSON.parse(JSON.stringify(puzzleData));
    loadPuzzle(clone);
    applyLoadedLevelToEditorForm(clone);
    if (typeof LEVELS !== "undefined" && Array.isArray(LEVELS)) {
      const idx = LEVELS.findIndex((l) => l && l.name === clone.name);
      if (idx >= 0) currentLevelIndex = idx;
    }
    const sel = document.getElementById("editorLevelsSelect");
    if (sel && typeof LEVELS !== "undefined" && Array.isArray(LEVELS)) {
      const idx = LEVELS.findIndex((l) => l && l.name === clone.name);
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
    if (typeof LEVELS === "undefined" || !Array.isArray(LEVELS) || LEVELS.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(levels.js not loaded or empty)";
      sel.appendChild(opt);
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    LEVELS.forEach((lvl, i) => {
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
      loadFromJsBtn.addEventListener("click", () => {
        if (typeof LEVELS === "undefined" || !Array.isArray(LEVELS) || LEVELS.length === 0) {
          updateStatus("LEVELS is empty. Check that js/levels.js loaded.");
          return;
        }
        const idx = parseInt(sel.value, 10);
        if (!Number.isFinite(idx) || idx < 0 || idx >= LEVELS.length) {
          updateStatus("Pick a level from the list.");
          return;
        }
        loadLevelIntoEditor(LEVELS[idx]);
        updateStatus(`Loaded "${LEVELS[idx].name || "level " + (idx + 1)}" from levels.js (Edit mode).`);
      });
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const puzzleData = JSON.parse(e.target.result);
          loadLevelIntoEditor(puzzleData);
          updateStatus(`Loaded JSON file: ${puzzleData.name || file.name}`);
        } catch (error) {
          updateStatus("Error parsing puzzle file: " + error.message);
        }
      };
      reader.readAsText(file);
      fileInput.value = "";
    });

    const jsonBtn = document.getElementById("editorLoadJsonBtn");
    if (jsonBtn) {
      jsonBtn.addEventListener("click", () => fileInput.click());
    }
  }

  /** Canvas edit-mode cell placement (called from game.js handleMove). */
  function cmEditorOnEditCell(row, col) {
    if (editMode === "block") {
      pushEditorUndoCheckpoint();
      board[row][col] = CELL_TYPES.SOLID_BLOCK;
      updateStatus(`Solid block placed at (${row}, ${col})`);
    } else if (editMode === "phase_block") {
      pushEditorUndoCheckpoint();
      board[row][col] = CELL_TYPES.PHASE_BLOCK;
      updateStatus(`Phase-through block placed at (${row}, ${col})`);
    } else if (editMode === "transformer") {
      pushEditorUndoCheckpoint();
      board[row][col] = CELL_TYPES.TRANSFORMER;
      updateStatus(`Transformer block placed at (${row}, ${col})`);
    } else if (editMode === "teleport") {
      pushEditorUndoCheckpoint();
      board[row][col] = CELL_TYPES.TELEPORT;
      if (!teleportBlocks.some((tp) => tp.row === row && tp.col === col)) {
        teleportBlocks.push({ row, col });
      }
      updateStatus(`Teleport block placed at (${row}, ${col})`);
    } else if (editMode === "objective") {
      const existingObjective = objectives.find((obj) => obj.row === row && obj.col === col);
      if (!existingObjective) {
        pushEditorUndoCheckpoint();
        board[row][col] = CELL_TYPES.OBJECTIVE;
        objectives.push({ row, col, completed: false });
        totalObjectives = objectives.length;
        updateObjectiveCount();
        updateStatus(`Objective placed at (${row}, ${col}). Total: ${totalObjectives}`);
      } else {
        updateStatus("Objective already exists at this position");
      }
    } else if (editMode === "erase") {
      pushEditorUndoCheckpoint();
      board[row][col] = CELL_TYPES.EMPTY;

      const teleportIndex = teleportBlocks.findIndex((tp) => tp.row === row && tp.col === col);
      if (teleportIndex !== -1) {
        teleportBlocks.splice(teleportIndex, 1);
      }

      const playerIndex = getPlayerAt(row, col);
      if (playerIndex !== -1) {
        players.splice(playerIndex, 1);
        updatePlayerCount();
      }

      if (goal && goal.row === row && goal.col === col) {
        goal = null;
      }

      const objectiveIndex = objectives.findIndex((obj) => obj.row === row && obj.col === col);
      if (objectiveIndex !== -1) {
        objectives.splice(objectiveIndex, 1);
        totalObjectives = objectives.length;
        objectivesCompleted = objectives.filter((obj) => obj.completed).length;
        updateObjectiveCount();
      }

      updateStatus(`Cell cleared at (${row}, ${col})`);
    } else if (editMode.startsWith("player_")) {
      pushEditorUndoCheckpoint();
      const piece = editMode.split("_")[1];
      board[row][col] = CELL_TYPES.PLAYER;
      players.push({ row, col, pieceType: piece });
      updatePlayerCount();
      updateStatus(
        `${piece.charAt(0).toUpperCase() + piece.slice(1)} placed at (${row}, ${col}). Total: ${players.length}`
      );
      if (gravityEnabled) {
        applyGravity();
      }
    } else if (editMode.startsWith("teleport_")) {
      const color = editMode.split("_")[1];
      const teleportType = {
        purple: CELL_TYPES.TELEPORT_PURPLE,
        green: CELL_TYPES.TELEPORT_GREEN,
        blue: CELL_TYPES.TELEPORT_BLUE,
        orange: CELL_TYPES.TELEPORT_ORANGE
      }[color];

      if (teleportType) {
        pushEditorUndoCheckpoint();
        board[row][col] = teleportType;
        if (!teleportBlocks.some((tp) => tp.row === row && tp.col === col)) {
          teleportBlocks.push({ row, col, type: teleportType });
        }
        updateStatus(`${color.charAt(0).toUpperCase() + color.slice(1)} teleporter placed at (${row}, ${col})`);
      }
    } else if (editMode === "goal") {
      pushEditorUndoCheckpoint();
      if (goal) board[goal.row][goal.col] = CELL_TYPES.EMPTY;
      board[row][col] = CELL_TYPES.GOAL;
      goal = { row, col };
      updateStatus(`Goal placed at (${row}, ${col})`);
      if (gravityEnabled) {
        applyGravity();
      }
    } else if (editMode === "counter_goal") {
      pushEditorUndoCheckpoint();
      if (goal) board[goal.row][goal.col] = CELL_TYPES.EMPTY;

      const cgInput = document.getElementById("counterGoalMoves");
      const moves = cgInput ? parseInt(cgInput.value, 10) || 5 : 5;

      board[row][col] = CELL_TYPES.COUNTER_GOAL;
      goal = { row, col, type: "counter", counter: moves };

      updateStatus(`Counter Goal placed at (${row}, ${col}) with ${goal.counter} moves`);
    } else if (editMode === "bomb") {
      if (board[row][col] === CELL_TYPES.EMPTY) {
        pushEditorUndoCheckpoint();
        board[row][col] = CELL_TYPES.BOMB;
        bombs.push({ row, col, direction: 1 });
        updateStatus(`Bomb placed at (${row}, ${col})`);
      } else {
        updateStatus("Cannot place bomb on occupied cell");
      }
    }
  }

  window.cmEditorOnEditCell = cmEditorOnEditCell;

  const modeSelect = document.getElementById("modeSelect");
  if (modeSelect) {
    modeSelect.addEventListener("change", (e) => {
      const newMode = e.target.value;
      const prevMode = mode;
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
        if (typeof window.cmResetEditorAfterPlaytest === "function") {
          window.cmResetEditorAfterPlaytest();
        }
        playTestBaseline = null;
        skipResetPhaseBlocks = true;
        if (typeof drawBoard === "function") drawBoard();
      }

      mode = newMode;
      selectedPlayerIndex = -1;
      updateStatus(`Mode: ${mode === "edit" ? "Edit Mode" : "Play Mode"}`);

      if (mode === "edit" && !skipResetPhaseBlocks) {
        resetPhaseBlocks();
      }

      showTransformerMenu = false;
      transformerPosition = null;
      transformerPlayerIndex = -1;

      if (mode === "play" && gravityEnabled && !gameWon) {
        applyGravity();
      }
      updateEditorUndoButton();
    });
  }

  const editModeSelect = document.getElementById("editMode");
  if (editModeSelect) {
    editModeSelect.addEventListener("change", (e) => {
      editMode = e.target.value;
      const cg = document.getElementById("counterGoalSettings");
      if (cg) cg.style.display = editMode === "counter_goal" ? "block" : "none";
    });
    editMode = editModeSelect.value;
  }

  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      saveLevelToFolder();
    });
  }

  const eraseBoardBtn = document.getElementById("eraseBoardBtn");
  if (eraseBoardBtn) {
    eraseBoardBtn.addEventListener("click", () => {
      if (
        confirm(
          "Erase the entire board? You can use Undo last edit once to restore if you change your mind."
        )
      ) {
        eraseBoard();
      }
    });
  }

  const editorUndoBtn = document.getElementById("editorUndoBtn");
  if (editorUndoBtn) {
    editorUndoBtn.addEventListener("click", undoEditorLastEdit);
    editorUndoBtn.disabled = true;
  }

  const copyLevelsJsBtn = document.getElementById("copyLevelsJsBtn");
  if (copyLevelsJsBtn) {
    copyLevelsJsBtn.addEventListener("click", copyPuzzleEntryForLevelsJs);
  }

  setupLevelLoadingUI();
})();
