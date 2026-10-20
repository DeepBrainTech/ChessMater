// A separate visual fixture: it never participates in numbered-level progress.
const board = Array.from({ length: 11 }, () => Array(16).fill(0));
const samples = [];
const players = [];
const targetPieces = [];
const bombs = [];
const movingPlatforms = [];
const ducks = [];
const laserBlocks = [];

function place(row, col, cellType, label, extra = {}) {
  if (samples.some(sample => sample.row === row && sample.col === col)) {
    throw new Error(`Duplicate style sample at ${row},${col}`);
  }
  board[row][col] = cellType;
  samples.push({ row, col, label, ...extra });
}

const pieces = [
  ["rook", "车"], ["bishop", "象"], ["queen", "后"],
  ["knight", "马"], ["king", "王"], ["pawn", "兵"], ["castle_rook", "易位车"],
];
pieces.forEach(([pieceType, name], index) => {
  const col = index * 2 + 1;
  place(0, col, 2, `玩家棋子：${name}`);
  players.push({ row: 0, col, pieceType, hasMoved: false });
});
pieces.slice(0, 6).forEach(([pieceType, name], index) => {
  const col = index * 2 + 1;
  place(1, col, 16, `黑色目标棋子：${name}`);
  targetPieces.push({ row: 1, col, pieceType, captured: false });
});
place(1, 13, 0, "已捕获的黑色目标棋子：只保留棋盘底格");
targetPieces.push({ row: 1, col: 13, pieceType: "king", captured: true });

place(2, 0, 0, "浅色底格");
place(2, 1, 0, "深色底格");
place(2, 3, 1, "普通实心障碍");
place(2, 5, 4, "单向穿透格：从下向上穿过");
place(2, 7, 5, "旧关卡穿透格：加载后与普通单向穿透格一致");
place(2, 9, 6, "转换格：普通", { variant: "transformer" });
place(2, 11, 6, "转换格：激活样式", { variant: "transformer-active" });
place(2, 13, 7, "检查点：未完成");
place(2, 15, 8, "检查点：已吃掉（只显示棋盘底格）");

[[10, "紫色"], [11, "绿色"], [12, "蓝色"], [13, "橙色"]].forEach(([type, color], index) => {
  place(3, index * 4, type, `${color}传送门：入口`);
  place(3, index * 4 + 1, type, `${color}传送门：出口`);
});

place(4, 1, 3, "普通终点：已解锁", { variant: "goal", locked: false });
place(4, 3, 3, "普通终点：锁定", { variant: "goal", locked: true });
place(4, 5, 9, "倒计时终点：剩余 5 步", { variant: "goal", counter: 5, locked: false });
place(4, 7, 9, "倒计时终点：剩余 2 步（警告色）", { variant: "goal", counter: 2, locked: false });
place(4, 9, 9, "倒计时终点：步数耗尽并锁定", { variant: "goal", counter: 0, locked: true });
place(4, 11, 0, "迷雾：深色底格", { variant: "fog" });
place(4, 12, 0, "迷雾：浅色底格", { variant: "fog" });
place(4, 14, 2, "选中棋子样式：不显示圆圈，所在格不显示移动标记");
players.push({ row: 4, col: 14, pieceType: "king", hasMoved: false });
place(4, 15, 0, "可移动位置标记", { variant: "possible-move" });

[
  { row: 5, col: 1, direction: 1, label: "横向炸弹：向右" },
  { row: 5, col: 3, direction: -1, label: "横向炸弹：向左" },
  { row: 5, col: 5, type: "boom_right", label: "斜向炸弹：右下" },
  { row: 5, col: 7, type: "boom_left", label: "斜向炸弹：左下" },
].forEach(({ label, ...bomb }) => {
  place(bomb.row, bomb.col, 14, label);
  bombs.push(bomb);
});
[-1, 1].forEach((direction, index) => {
  const col = 10 + index * 2;
  place(5, col, 0, `小鸭：朝${direction === -1 ? "左" : "右"}`);
  ducks.push({ row: 5, col, direction });
});
[
  { row: 6, col: 1, direction: -1, label: "升降平台：向上" },
  { row: 6, col: 3, direction: 1, label: "升降平台：向下" },
  { row: 6, col: 5, axis: "horizontal", direction: -1, label: "筋斗云平台：向左" },
  { row: 6, col: 7, axis: "horizontal", direction: 1, label: "筋斗云平台：向右" },
].forEach(({ label, ...platform }) => {
  place(platform.row, platform.col, 15, label);
  movingPlatforms.push(platform);
});

[
  [1, ["up"], "向上"], [4, ["down"], "向下"],
  [6, ["left"], "向左"], [10, ["right"], "向右"],
  [15, ["up", "down", "left", "right"], "四向"],
].forEach(([col, directions, name]) => {
  place(7, col, 1, `激光发射器：${name}，待发射`);
  laserBlocks.push({ row: 7, col, directions, fireEverySteps: 3 });
});
[
  [8, 3, ["left", "right"], "水平"],
  [7, 8, ["up", "down"], "垂直"],
  [8, 13, ["up", "down", "left", "right"], "四向"],
].forEach(([row, col, directions, name]) => {
  place(row, col, 1, `激光发射器与光束：${name}，发射中`);
  laserBlocks.push({ row, col, directions, fireEverySteps: 2 });
});
[[8, 0], [8, 6], [8, 10], [8, 15], [5, 8], [9, 8], [6, 13]].forEach(([row, col]) => {
  place(row, col, 1, "实心障碍：隔离激光展示区域");
});

place(9, 0, 9, "倒计时终点：剩余 1 步（临界状态）", { variant: "goal", counter: 1, locked: false });
place(9, 2, 9, "倒计时终点：有剩余步数但目标尚未完成", { variant: "goal", counter: 3, locked: true });
place(9, 4, 0, "迷雾已探索：恢复正常棋盘底格");
[
  [6, ["up", "down", "left"], "上、下、左"],
  [9, ["up", "down", "right"], "上、下、右"],
  [12, ["up", "left", "right"], "上、左、右"],
  [15, ["down", "left", "right"], "下、左、右"],
].forEach(([col, directions, name]) => {
  place(9, col, 1, `激光发射器：${name}，三向待发射`);
  laserBlocks.push({ row: 9, col, directions, fireEverySteps: 5 });
});
[
  [6, ["up", "left"], "上、左", 3],
  [9, ["up", "right"], "上、右", 4],
  [12, ["down", "left"], "下、左", 5],
  [15, ["down", "right"], "下、右", 3],
].forEach(([col, directions, name, fireEverySteps]) => {
  place(10, col, 1, `激光发射器：${name}，倒计时 ${fireEverySteps - 2} 步`);
  laserBlocks.push({ row: 10, col, directions, fireEverySteps });
});

export const styleTestLevel = {
  version: "1.3",
  name: "Test — All Board Elements",
  styleTest: true,
  rows: board.length,
  cols: 16,
  board,
  players,
  targetPieces,
  bombs,
  movingPlatforms,
  ducks,
  laserBlocks,
  goal: null,
  fog: false,
  objectives: [{ row: 2, col: 13, completed: false }, { row: 2, col: 15, completed: true }],
  samples,
  blockTip: "Test 全元素样式预览：包括全部玩家与目标棋子、已捕获目标、两种底格、障碍与新旧穿透格、转换格、完成前后的检查点、四种颜色的传送门入口与出口、普通与倒计时终点、锁定与临界状态、迷雾与已探索格、移动标记、四种炸弹、左右小鸭、四种平台方向，以及激光发射器的单向、双向、四向、发射与倒计时状态。点击格子可查看具体名称。此页面固定展示位置，不消耗道具，也不计入通关进度。",
};
