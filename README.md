# Sudoku PK

双人数独 PK 网页游戏。两名玩家进入同一个房间，解同一道数独，先正确提交的人获胜。

## 本地运行

```bash
npm start
```

打开 `http://localhost:3000`。

## Vercel 部署

这套应用在 Vercel 上需要配一个 `Vercel KV`，因为房间状态和比赛结果不能只放在无状态函数内存里。

### 1. 导入项目

把项目推到 GitHub，然后在 Vercel 里 `Add New -> Project` 导入仓库。

### 2. 创建 KV

在 Vercel 项目里添加一个 `Storage -> KV`。

Vercel 会自动注入下面两个环境变量:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

### 3. 部署

首次部署后，访问 Vercel 给出的域名即可开始创建房间。

## 接口

- `POST /api/rooms` 创建房间
- `POST /api/join` 加入房间
- `GET /api/state` 查询比赛状态
- `POST /api/submit` 提交答案
