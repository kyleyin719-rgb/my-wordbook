# 我的词书 · Lexuni

## 当前产品

本项目是在 Lexuni 上改造的本地优先个人英汉词书。第一阶段以词汇浏览与管理为核心，不展示测验、答题、学习统计、复习算法或练习历史。旧练习代码和数据库记录暂时保留，避免破坏既有数据和备份兼容。

## 技术和路由

- React、TypeScript、Vite、Tailwind CSS、Dexie / IndexedDB、`vite-plugin-pwa`。
- `/words`：全部单词；`/starred`：重点单词；`/recent`：最近添加。
- `/words/:id`：可直接打开的单词详情；`/add`：添加单词；`/words/import`：文本词表导入；`/settings`：主题和 JSON 数据管理。
- 桌面端使用左侧导航、中间词表、右侧详情；窄屏单栏显示词表或详情，底部导航为全部、重点、添加、设置。

## 数据

- 数据库仍名为 `LexuniDB`，现为 Dexie V5。保留 `words`、`groups`、`sessions`、`sessionAnswers` 四张表。
- `Word` 支持 `word`、`ipaUK`、`ipaUS`、`partOfSpeech`、`meaning`、`examples: {id, en, zh}[]`、`note`、`starred`、`createdAt`、`updatedAt`；继续保留兼容字段和 `groupId`。
- V4 迁移将 `english` 映射到 `word`，`turkish` 映射到 `meaning`。旧字段暂时保持同步，兼容仍在代码中的旧练习模块和原版完整备份。
- V5 迁移为旧例句补稳定 ID，并再次补齐可能缺失的音标、词性、笔记、星标和时间字段；迁移不删除词条。
- 手动新增单词时若没有分组，会创建“我的词汇”默认分组。删除最后一个词时不自动删除分组。
- 所有核心数据保存在 IndexedDB，主题偏好保存在 `localStorage`。

## 导入与导出

- 文本导入延用原版的分组预览、去重和事务写入；默认示例改为英汉词汇。
- `my-wordbook` JSON 用于合并导入和导出完整词条、例句、笔记及分组；导入预览会分别统计新增、重复和无效词条，按英文词条 trim 后忽略大小写跳过重复项。
- 原版 `lexuni-backup` 格式仍可完整导出与恢复。恢复时对旧词条进行规范化，再在一个事务内替换数据。

## 第二阶段交互

- 添加与编辑共用响应式编辑器；桌面为居中弹窗，手机为全屏弹窗。重复词不会写入，可直接打开已有词条。
- 搜索覆盖单词、英美音标、词性、中文释义、笔记及中英文例句。无结果时可把搜索词直接带入新增表单。
- 排序支持最近添加、A–Z、Z–A 和重点优先，并用版本化的 `localStorage` 偏好恢复选择。
- 语音逻辑集中在 `src/services/speech.ts`，支持英式单词、美式单词、例句朗读、播放互斥和播放状态。
- 添加、编辑、删除、星标、导入、导出和错误统一使用 Toast 反馈。

## 开发和验收

使用 Node.js 22.12+。运行 `npm ci`、`npm run dev`、`npm run lint`、`npm run build`。检查桌面三栏、手机单栏、浅色和深色主题、基础增删改查、JSON 导入导出和 PWA 构建。
