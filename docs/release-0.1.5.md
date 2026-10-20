# 0.1.5 正式发布记录

用户于 2026-10-20 确认 0.1.5-beta.1 Desktop 本轮验收通过，随后明确授权助手推送到 GitHub 和 npm。本次正式版本为 0.1.5。

本版包含新版 DSH 正文字号兼容、设置版本冲突恢复、恢复默认时的写入保护以及主题设置面板美化。主要变化和实际验收范围见 [CHANGELOG](../CHANGELOG.md)，开发、安装与组件核对见 [测试记录](web-iteration-0.1.5.md)。README 保持长期有效的项目介绍。

已验收客户端 SHA256：`2e7015ea90812f43b48086d6e8566e6be699c2f231a8609360af152dfb81f633`。本轮实际界面验收为 Desktop，Web 完成安装运行核对。正式包必须保留相同客户端。

通过仓库 `release.yml` 手动工作流和 npm OIDC 发布成功，npm 与 GitHub 使用同一个安装包。本地独立下载复核于北京时间 2026-10-20 20:12 完成。

## 发布入口

- npm：[`dsh-outerwilds-theme@0.1.5`](https://www.npmjs.com/package/dsh-outerwilds-theme/v/0.1.5)，`latest` 已指向 0.1.5。
- GitHub：[0.1.5 Release](https://github.com/xikan0/dsh-outerwilds-theme/releases/tag/0.1.5)，为最新正式版，非草稿、非预发布。
- 正式提交：[`49e66166c71dcfd096288da061efc7c7569df47b`](https://github.com/xikan0/dsh-outerwilds-theme/commit/49e66166c71dcfd096288da061efc7c7569df47b)，版本标签解析后指向该提交。
- [Release 工作流](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/39420261085)和源码 [Verify 检查](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/39418637876)全部通过。
- [安装包](https://github.com/xikan0/dsh-outerwilds-theme/releases/download/0.1.5/dsh-outerwilds-theme-0.1.5.tgz)与 [SHA256SUMS.txt](https://github.com/xikan0/dsh-outerwilds-theme/releases/download/0.1.5/SHA256SUMS.txt)。

## 发布经过

首次 [Release 工作流](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/39418637779)已完成类型检查、54 项测试、构建与发布预检查。npm OIDC 上传返回 HTTP 202，确认安装包已接收，但五分钟内注册表尚未公开该版本，因此工作流按超时失败；不能将此次上传直接记为发布验证通过。

等待 npm 处理期间，使用该次 CI 候选包、原校验文件与原中文发布说明完成 GitHub Release，标签指向同一正式提交，并独立下载校验。npm 公开 0.1.5 后，确认注册表 SHA1 和 integrity 与候选包相同，再以相同提交和验收客户端重新触发工作流。

第二次工作流识别已存在的完全一致版本，复用已提交的 npm 安装包及 GitHub Release，没有重复上传或改动标签；发布与两端校验全部通过。首次超时记录保留，不覆盖为成功结果。

## 核对结果

- 类型检查、54 项测试、构建、包内容检查、发布预检查与已验收客户端校验均通过。
- 已下载并复核最终 CI 候选包和 `publication-evidence`，`npmSubmitted`、`npmVerified`、`githubVerified` 均为 `true`。
- 本地独立下载 npm 和 GitHub 安装包、GitHub 校验文件，确认 SHA256、npm SHA512/SHA1、GitHub 附件 digest、版本标签和中文发布说明均匹配。
- GitHub README、npm 注册表的项目介绍和安装包 README 与正式提交一致，未为本次发版例行改写项目介绍。
- 正式包客户端与用户已验收的 0.1.5-beta.1 完全相同；本次发布没有再次安装或重启本机 Desktop，不能将正式包的线上校验记为新的本机安装验收。
- 本轮实际界面验收为 Desktop，Web 完成安装运行与组件核对；未据此宣称独立的 Web 实际外观验收。

## 安装包校验值

两端安装包均为 11,040,886 字节，最终 CI 候选包与首次上传包也完全相同。

| 项目 | 校验值 |
| --- | --- |
| 安装包 SHA256 | `d4466be5fd5c954b6c76f9a697a41688e78d58688f1191ee52541393d4d97669` |
| 安装包 SHA1 | `cfcadf5f7af20133e7bb0f9aba16a92c5d5742fc` |
| npm integrity | `sha512-auCyXYKBTu9KnW3YYRmMroOShvOZMFHbKKHsp7RE+1QbIvTWGRV1i7PU4Vx7y0OFmmNNetravDJyMzpKkw+YmA==` |
| 客户端 SHA256 | `2e7015ea90812f43b48086d6e8566e6be699c2f231a8609360af152dfb81f633` |

## 本地证据

- `.sandbox/iterations/0.1.5-beta.1/`：Web 与 Desktop 安装前备份、安装及运行检查、组件核对和用户验收记录。
- `.sandbox/release/0.1.5-local-final/`：本地正式候选包及发布预检查。
- `.sandbox/release/0.1.5-ci-publication-39418637779/` 与 `.sandbox/release/0.1.5-publication-39418637779/`：首次 CI 候选包、超时日志、发布证据及 GitHub 独立下载核对。
- `.sandbox/release/0.1.5-ci-publication-39420261085/`：最终 CI 候选包与预检查。
- `.sandbox/release/0.1.5-publication-39420261085/`：最终发布证据、两端下载包、校验文件与 `independent-verification.json`。

本地证据不随 npm 包发布，GitHub Release 长期保留安装包与校验文件。
