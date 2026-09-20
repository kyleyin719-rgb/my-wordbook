# 我的词书 · Lexuni

基于 [Lexuni](https://github.com/bektasing/lexuni) 改造的本地优先个人英汉词书。保留 React、TypeScript、Vite、Dexie / IndexedDB 和 PWA；无需账号或后端。

## 目前功能

- 全部单词、重点单词与最近添加视图；覆盖音标、释义、例句和笔记的实时搜索；最近添加、A–Z、Z–A、重点优先排序。
- 添加、编辑、删除词条；保存英美音标、词性、中文释义、例句、笔记和重点标记。
- 详情页用浏览器 Web Speech API 朗读英音、美音和英文例句，不请求收费 API，也不保存音频文件。可用音色取决于浏览器和设备。
- 保留按分组导入的文本词表；支持带验证预览的词书 JSON 合并导入与完整导出，也保留原版 Lexuni 完整备份的导出和恢复。
- 本地 IndexedDB 持久化、响应式界面和 PWA 安装能力。

原版练习、答题、统计与历史页面已从导航中隐藏。现有练习记录及对应数据表暂时保留，以便安全兼容旧备份。

## 运行

需要 Node.js 22.12 或更新版本。

```bash
npm ci
npm run dev
```

质量检查：

```bash
npm test
npm run lint
npm run build
```

## GitHub Pages 部署

本项目按仓库名 `my-wordbook` 配置，生产地址格式为 `https://<username>.github.io/my-wordbook/`。路由使用 HashRouter，例如 `https://<username>.github.io/my-wordbook/#/words`，可以直接刷新详情、重点、导入和设置页面。

在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中，把 **Source** 设为 **GitHub Actions**。之后每次推送 `main` 分支，`.github/workflows/deploy.yml` 会执行 `npm ci`、`npm run build` 并发布 `dist`。

部署只更新缓存的应用文件，不会修改浏览器 IndexedDB。不同设备、浏览器和域名拥有各自独立的本地词库，请通过 JSON 导出与导入迁移数据，并定期备份。

## 导入与备份

文本导入每行使用 `英文 = 中文释义`，可用 `# 分组名称` 命名该批词汇。词书 JSON 导入会跳过重复英文词，不替换现有词条。完整备份恢复会替换本浏览器中现有的数据，因此请先导出备份。

数据保存在当前浏览器的 IndexedDB 中。浏览器数据被清除时词书也会丢失，请定期导出 JSON。

## 开源许可

原项目由 Hamza Bektaş 开发，采用 [MIT License](LICENSE)。保留原项目许可与版权声明。
