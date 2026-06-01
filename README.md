# JIRA Commit Collector

一个极简 Chrome 插件：在 JIRA case 页面右键即可复制 GIT commit message，并把它收集进一个**本地按周分组的剪贴板**，方便周报/提交记录整理。

## 功能

- 在 JIRA case 页面（`*.atlassian.net/browse/*`）右键菜单：**Collect GIT commit message**
- 点击后：
  1. 把 case 标题（即 commit message）复制到系统剪贴板
  2. 把它追加到「本地剪贴板」中**当前周（周一为一周第一天）**的分组下
  3. 如果该 case 本周已收集过，提示 `Already added`，不会重复添加
- 点击插件图标打开 popup，即「本地剪贴板」：
  - 按周倒序展示，每条可点击跳转到对应 JIRA case
  - `Copy All` 复制全部（周与周之间空一行，格式适合直接粘贴）
  - 单条可单独复制或删除，`Clear` 清空全部

## 安装（开发者模式）

1. 打开 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录 `chrome_extension`

## 数据存储

收集的内容保存在 `chrome.storage.local`，仅本地、跨重启保留。卸载插件会清除。

## 周第一天规则

按 ISO 标准，**周一**为一周第一天。如需改为周日，修改 `js/background.js` 中 `getWeekStartKey`。

## 复制全部时的文本格式

```
2026-06-01
WEB-122711 修复xxx
WEB-122800 新增yyy

2026-05-25
WEB-122001 重构zzz
```
