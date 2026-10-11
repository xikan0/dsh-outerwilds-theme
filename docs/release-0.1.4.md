# 0.1.4 正式发布记录

用户于 2026-10-11 确认保留 Web 的 0.1.4-beta.5 外观，并明确批准发布到 npm 和 GitHub。

本版包含 README 精简、版本无关的安装与更新示例、宇宙之眼与深巨星图标，以及侧边栏和输入框美化。具体内容见 [CHANGELOG](../CHANGELOG.md)。README 继续用于 GitHub 首页及 npm 项目介绍，不随每次版本更新例行改写。

已验收 Web 客户端 SHA256：`ca56af3c436f0331e09ab59b9dd8c33987d832373c231d80d32362e3cf598b83`。正式发布须使用相同客户端。验收范围为本轮 Web 实际外观、安装运行与自动检查；Desktop 未进行本轮安装或实际外观验收。

通过仓库 `release.yml` 手动工作流和 npm OIDC 发布成功，npm 与 GitHub 使用同一个安装包。本地独立下载复核于北京时间 2026-10-11 10:12 完成。

## 发布入口

- npm：[`dsh-outerwilds-theme@0.1.4`](https://www.npmjs.com/package/dsh-outerwilds-theme/v/0.1.4)，`latest` 已指向 0.1.4。
- GitHub：[0.1.4 Release](https://github.com/xikan0/dsh-outerwilds-theme/releases/tag/0.1.4)，为最新正式版，非草稿、非预发布。
- 正式提交：[`1ca0144e17b9f97df462c3aaecc2a0fb1e0762f1`](https://github.com/xikan0/dsh-outerwilds-theme/commit/1ca0144e17b9f97df462c3aaecc2a0fb1e0762f1)，版本标签解析后指向该提交。
- [Release 工作流](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/38103968874)和 [Verify 检查](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/38103968640)全部通过。
- [安装包](https://github.com/xikan0/dsh-outerwilds-theme/releases/download/0.1.4/dsh-outerwilds-theme-0.1.4.tgz)与 [SHA256SUMS.txt](https://github.com/xikan0/dsh-outerwilds-theme/releases/download/0.1.4/SHA256SUMS.txt)。

## 核对结果

- 类型检查、46 项测试、构建、包内容检查、发布预检查与已验收客户端校验均通过。
- 已下载并复核 CI 候选包和 `publication-evidence`，`npmSubmitted`、`npmVerified`、`githubVerified` 均为 `true`。
- 本地独立下载 npm 和 GitHub 安装包、GitHub 校验文件，确认 SHA256、npm SHA512/SHA1、GitHub 附件 digest、版本标签和中文发布说明均匹配。
- GitHub README、npm 注册表的项目介绍和安装包 README 与用户确认的精简稿一致，保留不指定版本号的安装示例与 `--latest` 更新示例。
- 本地 Web 已从 CI 正式包安装 0.1.4 并重启，实际服务提供的客户端与 beta.5 完全一致；其他插件版本、bundle 顺序和用户设置保持。用户此前启用的音频响应也保持启用。
- 本轮实际视觉验收为 Web；未在 Desktop 安装本轮正式包，未声明 Desktop 本轮实际外观验收。

## 安装包校验值

两端安装包均为 11,039,216 字节。

| 项目 | 校验值 |
| --- | --- |
| 安装包 SHA256 | `461a114766ea6e62b8a5af050bc033307d505bf23db67d2774361041e1b27e53` |
| 安装包 SHA1 | `794f754077f12f0e351f766f4d5801371d8a91dc` |
| npm integrity | `sha512-5Rg3TeHd90n7hJR/dqjvy4Zr2PopIPzhmgb/ylg7y4JHkVgVZVeRNyRrPTsAbF3WzyA5QYHHWGmINmTW59ogPA==` |
| 客户端 SHA256 | `ca56af3c436f0331e09ab59b9dd8c33987d832373c231d80d32362e3cf598b83` |

## 本地证据

- `.sandbox/iterations/0.1.4/`：安装前配置备份、安装检查与运行检查。
- `.sandbox/release/0.1.4-ci-publication-38103968874/`：CI 候选包、预检查和发布结果附件。
- `.sandbox/release/0.1.4-publication-38103968874/`：两端下载包、校验文件与独立复核记录。

GitHub 安装包第一次本地直连下载超时，随后改用 GitHub CLI 下载成功并完成相同校验。本地证据不随 npm 包发布，GitHub Release 长期保留安装包与校验文件。
