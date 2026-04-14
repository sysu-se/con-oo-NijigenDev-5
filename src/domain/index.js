export function createSudoku(input) {
    // 深拷贝防止外部通过引用直接修改内部数据
    const grid = input.map(row => [...row]);

    const getGrid = () => {
        // 同样返回深拷贝，确保外部拿到数据后无法篡改当前状态
        return grid.map(row => [...row]);
    };

    // 局面校验能力：检查数独中目前的无效格子
    const getInvalidCells = () => {
        const _invalidCells = [];
        const addInvalid = (x, y) => {
            const isDuplicate = _invalidCells.some(cell => cell.x === x && cell.y === y);
            if (!isDuplicate) _invalidCells.push({ x, y });
        };

        for (let y = 0; y < 9; y++) {
            for (let x = 0; x < 9; x++) {
                const value = grid[y][x];
                if (value) {
                    for (let i = 0; i < 9; i++) {
                        // 检查行
                        if (i !== x && grid[y][i] === value) addInvalid(x, y);
                        // 检查列
                        if (i !== y && grid[i][x] === value) addInvalid(x, i);
                    }
                    // 检查3x3小九宫格
                    const startY = Math.floor(y / 3) * 3;
                    const endY = startY + 3;
                    const startX = Math.floor(x / 3) * 3;
                    const endX = startX + 3;
                    for (let row = startY; row < endY; row++) {
                        for (let col = startX; col < endX; col++) {
                            if (row !== y && col !== x && grid[row][col] === value) {
                                addInvalid(col, row);
                            }
                        }
                    }
                }
            }
        }
        return _invalidCells;
    };

    // 判定数独是否已获胜（全部填满且没有冲突格子）
    const isSolved = () => {
        for (let y = 0; y < 9; y++) {
            for (let x = 0; x < 9; x++) {
                // 空格可能被表示为 0 或者 null
                if (grid[y][x] === 0 || grid[y][x] === null) return false;
            }
        }
        return getInvalidCells().length === 0;
    };

    const guess = (move) => {
        const { row, col, value } = move;

        // 范围检查：确保坐标在0-8之内
        if (row < 0 || row > 8 || col < 0 || col > 8) {
            console.warn("Invalid coordinate:", move);
            return;
        }

        // 值检查：确保填入的是0-9之间的数字，或者null（清空）
        if (value !== null && (typeof value !== 'number' || value < 0 || value > 9)) {
            console.warn("Invalid value:", value);
            return;
        }

        // 在指定坐标填入数字（如果 value 为 null 或者 0 等于清除）
        grid[row][col] = value;
    };

    const clone = () => {
        // 创建一个当前棋盘的独立副本
        return createSudoku(grid);
    };

    const toJSON = () => {
        // 保存游戏时序列化
        return { grid: grid.map(row => [...row]) };
    };

    const toString = () => {
        // 打印到控制台时能够看到棋盘长什么样，方便调试，并且统一把 0 也视为 .
        return grid.map(r => r.map(v => (v === null || v === 0 ? '.' : v)).join(' ')).join('\n');
    };

    // 返回组装好的实例
    return {
        getGrid,
        getInvalidCells,
        isSolved,
        guess,
        clone,
        toJSON,
        toString
    };
}

export function createSudokuFromJSON(json) {
    // 反序列化：从普通的 {} 字典重新变成一个拥有各种方法的 Sudoku 领域对象
    return createSudoku(json.grid);
}

export function createGame({ sudoku, history, currentIndex }) {
    let currentSudoku = sudoku.clone();

    // 历史记录数组，默认只包含最初始的局面
    // 如果你传了已有的 history 进来，就用已有的，这用于从存档恢复游戏
    let _history = history ? history.map(s => s.clone()) : [currentSudoku.clone()];
    let _currentIndex = currentIndex !== undefined ? currentIndex : 0;

    // 保留一份最原始的题面引用，用于充当不可编辑的依据
    const initialSudoku = _history[0].clone();

    const getSudoku = () => {
        // 返回深拷贝后的副本，防止被外部不走 guess 等流程直接拿到引用从而恶意篡改（违背历史记录）
        return currentSudoku.clone();
    };

    // 获取初始题面，方便 UI 渲染区分
    const getInitialSudoku = () => {
        return initialSudoku.clone();
    };

    const applyHint = (move) => {
        // 提示变成固定题目
        initialSudoku.guess(move);
        // 同样应用到当前状态和所有历史快照中，确保彻底固化并不会被撤销掉
        currentSudoku.guess(move);
        _history.forEach(s => s.guess(move));
    };

    const guess = (move) => {
        const { row, col } = move;

        // 初始题面自带的数字不允许被篡改
        const initialGrid = initialSudoku.getGrid();
        if (initialGrid[row][col] !== 0 && initialGrid[row][col] !== null) {
            console.warn("Cannot modify an initial given cell at", row, col);
            return;
        }

        // 撤销操作后又下了一步新棋，那么原来被撤销的会被舍弃
        _history = _history.slice(0, _currentIndex + 1);

        // 生成下一步的数独状态，应用操作，然后更新指针
        const nextSudoku = currentSudoku.clone();
        nextSudoku.guess(move);
        currentSudoku = nextSudoku;

        // 将新状态压入历史记录本
        _history.push(currentSudoku.clone());
        _currentIndex++;
    };

    const canUndo = () => {
        return _currentIndex > 0;
    };

    const canRedo = () => {
        return _currentIndex < _history.length - 1;
    };

    const undo = () => {
        if (canUndo()) {
            _currentIndex--;
            // 直接从历史记录里把那一刻的棋盘快照拿出来覆盖当前棋盘
            currentSudoku = _history[_currentIndex].clone();
        }
    };

    const redo = () => {
        if (canRedo()) {
            _currentIndex++;
            currentSudoku = _history[_currentIndex].clone();
        }
    };

    const toJSON = () => {
        // 把历史记录里的每一个数独状态都转换成JSON字典
        return {
            history: _history.map(s => s.toJSON()),
            currentIndex: _currentIndex
        };
    };

    return {
        getSudoku,
        getInitialSudoku,
        applyHint,
        guess,
        undo,
        redo,
        canUndo,
        canRedo,
        toJSON
    };
}

export function createGameFromJSON(json) {
    // 从 JSON 存档中恢复整局游戏和历史记录
    const restoredHistory = json.history.map(s => createSudokuFromJSON(s));

    return createGame({
        sudoku: restoredHistory[json.currentIndex].clone(),
        history: restoredHistory,
        currentIndex: json.currentIndex
    });
}
