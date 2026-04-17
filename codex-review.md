# con-oo-NijigenDev-5 - Review

## Review 结论

当前实现已经把领域对象接入了真实 Svelte 游戏流程，开始新局、棋盘渲染、输入、提示、Undo/Redo 与胜利判定都能沿着 domain store 进入 `Game`/`Sudoku`，这一点是达标的。但从设计质量看，领域不变式、历史模型和响应式边界仍有关键缺口，因此整体更接近“已接入、可工作，但建模与架构仍需收紧”的状态。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | fair |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. 数独值域不变式没有被领域层真正守住

- 严重程度：core
- 位置：src/domain/index.js:57-74
- 原因：`guess` 只校验“是不是 number 且在 0-9 之间”，因此 `NaN`、`1.5` 这类并非合法数独值的输入仍会被接受。随后 `isSolved` 只排除 `0/null`，`getInvalidCells` 又会跳过 falsy 的 `NaN`，领域对象因此可能表示一个并非合法数独的局面，甚至被误判为已完成。对数独业务而言，这是核心不变式缺失。

### 2. Hint 通过回写全部历史快照破坏了历史模型

- 严重程度：core
- 位置：src/domain/index.js:129-135
- 原因：`applyHint` 直接修改 `initialSudoku`、`currentSudoku` 以及 `_history` 中每一个快照。这样做虽然把 hint 固化成“不可撤销的 givens”，但代价是历史不再代表真实过去状态，Undo/Redo 的语义被后续命令改写，history 也失去了 snapshot 应有的不可变性。这会直接削弱 `Game` 作为历史管理者的建模质量。

### 3. Store adapter 泄漏了可变的 Game 实例

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/domain.js:80-83
- 原因：`getGame()` 把内部 `gameInstance` 直接暴露出去，而当前 UI 刷新依赖 `domainStore` 自己的 `sync()`。一旦外部直接调用返回对象上的 `guess/undo/redo`，就会绕过 store 通知，出现“领域对象变了但界面不刷新”的风险。这与作业要求中推荐的 adapter 边界是冲突的。

### 4. 候选数/笔记状态游离于 Game 历史之外

- 严重程度：major
- 位置：src/components/Controls/Keyboard.svelte:12-25; src/node_modules/@sudoku/stores/candidates.js:3-29; src/domain/index.js:137-180
- 原因：用户输入数字时，候选数在独立 store 中增删，`Game.undo()`/`redo()` 只回放棋盘快照，不回放候选数或笔记相关状态。这意味着棋盘回退后，辅助状态不一定与该时刻的局面一致。对数独游戏来说，这会让“玩家状态”只被部分建模。

### 5. 组件中对 store 使用裸 subscribe，不符合更典型的 Svelte 写法

- 严重程度：minor
- 位置：src/App.svelte:12-17
- 原因：`gameWon.subscribe(...)` 写在组件顶层且没有显式清理。虽然在单例根组件里通常不会立刻出问题，但从 Svelte 惯例看，更推荐使用 `$gameWon` 配合 reactive statement，或在生命周期中订阅并清理，这样依赖关系和资源边界更清楚。

## 优点

### 1. 开始新局、输入、提示、Undo/Redo 已统一走领域入口

- 位置：src/node_modules/@sudoku/stores/grid.js:16-25,47-60; src/node_modules/@sudoku/stores/domain.js:45-77; src/components/Controls/ActionBar/Actions.svelte:27-39; src/components/Controls/Keyboard.svelte:18-24
- 原因：新游戏通过 `domainStore.init` 创建 `Game`，用户输入通过 `domainStore.guess` 进入领域对象，Undo/Redo 也直接调用 `Game`。这说明真实界面的主流程已经不再直接操作旧数组，而是消费领域层能力。

### 2. 渲染层消费的是领域导出的响应式视图状态

- 位置：src/node_modules/@sudoku/stores/grid.js:9-10,41-42,66; src/components/Board/index.svelte:40-51; src/node_modules/@sudoku/stores/game.js:6-7
- 原因：棋盘渲染读取的是由 `domainStore` 派生出的 `grid/userGrid/invalidCells`，胜利态由 `domainStore.isSolved` 派生。这条“领域对象 -> store adapter -> Svelte 组件”的链路是清楚的，符合题目强调的真实接入方向。

### 3. 对外读取时普遍使用副本，降低了别名修改风险

- 位置：src/domain/index.js:1-8,76-84,119-126
- 原因：`getGrid`、`getSudoku`、`getInitialSudoku`、`toJSON` 都返回拷贝而不是直接暴露内部数组，说明作者已经意识到 UI 层和领域层之间的引用共享会破坏历史与封装。这个防御性设计是有价值的。

### 4. `Sudoku` 与 `Game` 的职责分工基本成立

- 位置：src/domain/index.js:10-55,108-201
- 原因：`Sudoku` 主要负责棋盘数据、校验、序列化与基本落子，`Game` 主要负责当前局面、历史与 Undo/Redo。虽然边界还有改进空间，但核心职责没有继续散落在 `.svelte` 组件中，这一点是正向的 OOD 信号。

## 补充说明

- 本次结论仅基于静态阅读，未运行测试，也未实际操作界面流程。
- 关于“主流程已接入 Svelte”的判断，基于静态追踪 `@sudoku/game` -> `grid/userGrid` -> `domainStore` -> `createGame/createSudoku` 的调用链得出。
- 关于 `NaN`/非整数可进入领域对象、hint 会改写历史、候选数不会随 Undo/Redo 回滚等结论，均来自代码静态推导，而非运行时验证。
