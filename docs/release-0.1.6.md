# 0.1.6 正式发布记录

用户于 2026-10-20 在 Desktop 清理该主题历史配置并重新安装 0.1.6-beta.1 后，保持 DSH 原生深色，确认第一次点击“启用深色主题”成功。随后用户明确同意将修复版 0.1.6 发布到 GitHub 和 npm。

本版针对真实报错 `settings/rejected: No configurable plugin entry "ui-outerwilds-theme"` 修复启用前的宿主入口同步顺序，不将其与 0.1.5 的版本冲突混为一谈。变更见 [CHANGELOG](../CHANGELOG.md)，错误证据、真实宿主回归、首次安装环境重建与用户确认见 [测试记录](web-iteration-0.1.6.md)。README 保持长期有效的项目介绍。

已验收客户端 SHA256：`846fc25296c314aeb217204cf24679efd637eb62eb10dffcb4fe12383b472440`。正式构建必须保持相同客户端。本轮实际确认范围为 Desktop 首次启用；Web 完成安装运行核对，不扩大为其他场景的全面验收。

通过仓库 `release.yml` 手动工作流和 npm OIDC 发布成功，npm 与 GitHub 使用同一个安装包。首次工作流已完成发布和两端校验，无需重新上传或恢复发布。本地独立下载复核于北京时间 2026-10-20 21:39 完成。

## 发布入口

- npm：[`dsh-outerwilds-theme@0.1.6`](https://www.npmjs.com/package/dsh-outerwilds-theme/v/0.1.6)，本次核对时 `latest` 已指向 0.1.6。
- GitHub：[0.1.6 Release](https://github.com/xikan0/dsh-outerwilds-theme/releases/tag/0.1.6)，本次核对时为最新正式版，非草稿、非预发布。
- 正式提交：[`4889f0d4b2def82ffdf94d137cf6001e5efe8c95`](https://github.com/xikan0/dsh-outerwilds-theme/commit/4889f0d4b2def82ffdf94d137cf6001e5efe8c95)，版本标签解析后指向该提交。
- [Release 工作流](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/39429681060)和源码 [Verify 检查](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/39429680375)全部通过。
- [安装包](https://github.com/xikan0/dsh-outerwilds-theme/releases/download/0.1.6/dsh-outerwilds-theme-0.1.6.tgz)与 [SHA256SUMS.txt](https://github.com/xikan0/dsh-outerwilds-theme/releases/download/0.1.6/SHA256SUMS.txt)。

## 核对结果

- 类型检查、58 项测试、构建、包内容检查、发布预检查与已验收客户端校验均通过。
- 已下载并复核 CI 候选包和 `publication-evidence`，`npmSubmitted`、`npmVerified`、`githubVerified` 均为 `true`。
- 本地独立下载 npm 和 GitHub 安装包、GitHub 校验文件，确认 SHA256、npm SHA512/SHA1、GitHub 附件 digest、版本标签和中文发布说明均匹配；线上安装包与本地、CI 候选包完全相同。
- GitHub README、npm 注册表的项目介绍和安装包 README 与正式提交一致，未为本次发版例行改写项目介绍。
- 独立下载期间发生连接中断和超时，重试下载核对后通过；发布工作流本身成功，没有因此重复发布。
- 正式包客户端与用户已验收的 0.1.6-beta.1 完全相同；本次发布没有重新安装、清理配置或重启本机 Desktop，不能将线上校验记为新的本机安装验收。
- 本轮实际界面验收为 Desktop 首次安装待启用、DSH 原生深色下的第一次点击。Web 完成安装运行核对，不据此宣称其他场景的全面验收。

## 安装包校验值

两端安装包均为 11,041,892 字节。

| 项目 | 校验值 |
| --- | --- |
| 安装包 SHA256 | `37b32f7d64fd033af2f694e24491b151ced46e162a9c808e936c13b9cc1af2b1` |
| 安装包 SHA1 | `40f0f7e04d674bb297f40c8439be6a4495c85f24` |
| npm integrity | `sha512-cQiG9aHGA8sBVfsZNBOVSzBKnjstc61iHMmHxK9ptMfM2d7js/cYsVdPSzRpQKGTMnDMyjQCYHkYRulIJUk/0Q==` |
| 客户端 SHA256 | `846fc25296c314aeb217204cf24679efd637eb62eb10dffcb4fe12383b472440` |

## 本地证据

- `.sandbox/iterations/0.1.6-beta.1/`：测试包、安装前备份、首次安装状态重建、安装运行核对与用户验收记录。
- `.sandbox/diagnostics/activation-0.1.6/`：实际错误、真实隔离宿主复现与已安装客户端设置链路回归。
- `.sandbox/release/0.1.6-local-final/`：本地正式候选包与发布预检查。
- `.sandbox/release/0.1.6-ci-publication-39429681060/`：CI 候选包与预检查。
- `.sandbox/release/0.1.6-publication-39429681060/`：最终发布证据、两端下载包、校验文件与 `independent-verification.json`。

本地证据不随 npm 包发布，GitHub Release 长期保留安装包与校验文件。
