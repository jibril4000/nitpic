<p align="center">
  <img src="../assets/cover.png" alt="nitpic" width="640" />
</p>

<h3 align="center">点击任意元素，说出问题所在，看 Claude 把它修好。</h3>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-91C31C?style=flat-square" alt="MIT 许可证" /></a>
  <img src="https://img.shields.io/badge/Chrome%20Web%20Store-%E5%8D%B3%E5%B0%86%E4%B8%8A%E7%BA%BF-FF8C00?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store" />
  <img src="https://img.shields.io/badge/Claude%20Code-%E6%8F%92%E4%BB%B6-91C31C?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code 插件" />
  <a href="https://buymeacoffee.com/jibrilai"><img src="https://img.shields.io/badge/%E2%98%95-%E8%AF%B7%E6%88%91%E5%96%9D%E6%9D%AF%E5%92%96%E5%95%A1-FFDD00?style=flat-square" alt="请我喝杯咖啡" /></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

**nitpic** 把你的浏览器和 [Claude Code](https://claude.com/claude-code) 连在一起。开启反馈模式，在任何页面（`localhost` 或线上环境）点击任意元素，写下需要修改的内容并发送。你的评论、裁剪后的截图和元素的 HTML 会**如同你亲手输入一般**出现在正在运行的 Claude Code 会话里，Claude 随即开工。

为在浏览器里审查应用、在终端里修复问题的设计师、开发者和 Vibe Coder 打造。

## ✨ 功能亮点

- **🎯 直指问题** — 悬停高亮任意元素，或拖拽框选区域；CSS 选择器、截图和 HTML 由 nitpic 自动捕获
- **⚡ 即时送达** — 反馈一秒内抵达终端（tmux 和 iTerm2 享受真正的键入注入；其他终端在 Claude 的下一轮送达）
- **🎛 会话由你指定** — 在需要接收反馈的 Claude Code 会话中输入 `/nitpic`；在其他会话再次运行即可转移连接
- **📚 批量审查** — 跨页面、跨标签页收集评论，按页面分组一次性发送
- **🫧 悬浮面板** — 可拖动、可折叠为胶囊，绝不挤压视口，也不会触发响应式断点
- **🔒 完全本地** — 无账号、无服务器、无遥测；一切都留在你的机器上
- **🪄 零摩擦配置** — 配对全自动完成；无需复制代码，无需修改配置文件

## 🚀 快速开始

**1. 安装 Chrome 扩展** — *（Web Store 链接即将上线；在此之前：`chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → `extension/dist`）*

**2. 安装 Claude Code 插件** — 在任意会话中粘贴：

```
/plugin marketplace add jibril4000/nitpic
/plugin install nitpic@nitpic
```

**3. 连接** — 在需要接收反馈的会话中：

```
/nitpic
```

**4. 开始挑刺** — 在正在审查的页面点击 nitpic 图标 → **Start feedback** → 点击任意元素 → 写评论 → **Send**。整个流程就是这么简单。

## 🧠 工作原理

| 你的终端 | 送达方式 |
| --- | --- |
| tmux | ⚡ 即时 — 注入到精确的窗格 |
| iTerm2 | ⚡ 即时 — 通过会话 API 注入 |
| 其他 | ⏭ 轮次边界 — Claude 完成当前回复后送达，并附桌面通知 |

截图和 HTML 片段写入 `<项目>/.feedback/`（自动加入 `.gitignore`）。若没有会话在监听，反馈会在磁盘上排队，待会话连接后自动送达。

## 🔒 隐私与安全

一切都在本地：交换机只监听 `127.0.0.1`，配对令牌（自动交换）防止任意网页伪造反馈。扩展不收集任何数据。

## 🗺 路线图

- [x] Claude Code
- [ ] Cursor
- [ ] Codex
- [ ] Gemini CLI
- [ ] VS Code 终端注入
- [ ] 设备尺寸预览
- [ ] Chrome Web Store + 免令牌配对

## ☕ 支持项目

如果 nitpic 帮你省下了十次来回，[请我喝杯咖啡](https://buymeacoffee.com/jibrilai)。作者：[Jibril](https://linkedin.com/in/jibril-ai)

## 📝 许可证

[MIT](../LICENSE)
