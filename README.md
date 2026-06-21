# AI 实时对话画布

基于 Vite + React + TypeScript + Tailwind CSS v4 构建的纯前端 AI 对话画布应用。用户通过自然语言指令在 Canvas 上绘制矢量图形，支持 undo/redo 和历史指令回滚。

## 本地启动方式

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

启动后访问 `http://localhost:5173` 即可使用。

## 功能特性

- ✅ 自然语言指令解析（中英文混合支持）
- ✅ Canvas 矢量图形增量渲染
- ✅ 每次新指令不清除已有图形
- ✅ Undo / Redo 操作（支持快捷键 Ctrl+Z / Ctrl+Y）
- ✅ 历史指令列表，点击任意指令可回滚到该状态
- ✅ 内置规则引擎，无需接入真实 LLM

## 关键词规则表

### 1. 动作关键词 (Action)

| 关键词（中英文） | 动作类型 | 说明 |
|----------------|---------|------|
| 画、绘制、draw、paint | draw | 绘制图形 |
| 连接、connect、link | connect | 连接两点或多点 |
| 添加、add | add | 添加图形 |
| 创建、create、make | create | 创建图形 |
| 放置、place、put | place | 放置图形 |
| 写、写入、write | write | 写入文字 |

### 2. 形状关键词 (Shape)

| 关键词（中英文） | 形状类型 | 说明 |
|----------------|---------|------|
| 圆形、圆、circle | circle | 圆形 |
| 矩形、长方形、方形、rectangle、square | rectangle | 矩形 |
| 三角形、triangle | triangle | 三角形 |
| 直线、线、line | line | 直线（带箭头） |
| 折线、polyline | polyline | 多点折线（带箭头） |
| 文字、文本、text | text | 文字 |
| 点、point | point | 标记点 |

### 3. 颜色关键词 (Color)

| 关键词（中英文） | 颜色值 | 说明 |
|----------------|--------|------|
| 红色、红、red | #ef4444 | 红色 |
| 蓝色、蓝、blue | #3b82f6 | 蓝色（默认） |
| 绿色、绿、green | #22c55e | 绿色 |
| 黄色、黄、yellow | #eab308 | 黄色 |
| 黑色、黑、black | #000000 | 黑色 |
| 白色、白、white | #ffffff | 白色 |
| 紫色、紫、purple | #a855f7 | 紫色 |
| 橙色、橙、orange | #f97316 | 橙色 |
| 粉色、粉、pink | #ec4899 | 粉色 |
| 灰色、灰、gray | #6b7280 | 灰色 |

### 4. 位置关键词 (Position)

| 关键词（中英文） | 位置类型 | 说明 |
|----------------|---------|------|
| 左上角、左上、top-left | top-left | 左上角 |
| 右上角、右上、top-right | top-right | 右上角 |
| 左下角、左下、bottom-left | bottom-left | 左下角 |
| 右下角、右下、bottom-right | bottom-right | 右下角 |
| 中间、中央、center、middle | center | 正中间（默认） |
| 顶部、上方、top | top | 顶部中央 |
| 底部、下方、bottom | bottom | 底部中央 |
| 左边、左侧、left | left | 左侧中央 |
| 右边、右侧、right | right | 右侧中央 |

### 5. 尺寸关键词 (Size)

| 关键词 | 尺寸值 | 说明 |
|-------|--------|------|
| 大号、大 | 80px | 大尺寸 |
| 中号、中 | 50px | 中等尺寸（默认） |
| 小号、小 | 30px | 小尺寸 |
| 数字（如 100） | 数字值 | 自定义像素尺寸 |

### 6. 点标记规则

- 使用大写字母 A-Z 标记点，例如：`A点`、`B点`
- 先创建带标记的点，再连接：
  ```
  画一个红色圆形A点在左上角
  画一个蓝色圆形B点在右下角
  连接A点和B点
  ```

## 指令示例

### 基础绘图
```
画一个红色圆形在左上角
画一个蓝色矩形在右下角
画一个绿色三角形在中间
画一个大号黄色圆形在右上角
```

### 点与连接
```
画一个红色圆形A点在左上角
画一个蓝色矩形B点在右下角
用折线连接A、B、C点
```

### 文字
```
写"Hello World"在顶部
写"你好"在中间，黑色
```

### 组合指令
```
画一个紫色大号三角形A点在左下角
画一个粉色小号圆形B点在右上角
连接A点和B点，绿色
```

## 项目结构

```
src/
├── components/
│   ├── Canvas.tsx        # Canvas 画布组件
│   ├── CommandInput.tsx  # 指令输入组件
│   ├── HistoryList.tsx   # 历史指令列表组件
│   └── Toolbar.tsx       # 工具栏组件
├── types.ts              # TypeScript 类型定义
├── ruleEngine.ts         # 规则引擎（关键词解析）
├── shapeGenerator.ts     # 图形生成器
├── App.tsx               # 主应用组件
├── main.tsx              # 入口文件
└── index.css             # 全局样式（Tailwind v4）
```

## 验证方式

1. 启动应用：`npm run dev`
2. 依次发送以下三条指令：
   ```
   画一个红色圆形在左上角
   画一个蓝色矩形在右下角
   画一个绿色三角形在中间
   ```
3. 观察画布：应正确累积显示三个不同的图形
4. 点击 Undo 按钮（或按 Ctrl+Z）：最后一个绿色三角形应被撤销
5. 点击 Redo 按钮（或按 Ctrl+Y）：绿色三角形应重新出现

## 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **样式**: Tailwind CSS v4
- **渲染**: HTML5 Canvas API
