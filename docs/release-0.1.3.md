# 0.1.3 正式发布记录

2026-10-10 完成音频响应版本开发与代码审查，在用户验收并批准发布后，通过 GitHub Actions 和 npm OIDC 发布正式版。发布时间为北京时间 22:25，本地独立下载复核于 22:28 完成。

## 版本与入口

- npm 包：[`dsh-outerwilds-theme@0.1.3`](https://www.npmjs.com/package/dsh-outerwilds-theme/v/0.1.3)，`latest` 已指向 0.1.3。
- GitHub：[0.1.3 Release](https://github.com/xikan0/dsh-outerwilds-theme/releases/tag/0.1.3)，为最新正式版本，非草稿、非预发布。
- 正式提交：[`1a1e19653d7ff6918728a14884c9b3926161d539`](https://github.com/xikan0/dsh-outerwilds-theme/commit/1a1e19653d7ff6918728a14884c9b3926161d539)。版本标签解析后指向该提交。
- 发布工作流：[38059386359](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/38059386359)，prepare 和 publish 均成功。
- 安装包：[dsh-outerwilds-theme-0.1.3.tgz](https://github.com/xikan0/dsh-outerwilds-theme/releases/download/0.1.3/dsh-outerwilds-theme-0.1.3.tgz)。
- 校验文件：[SHA256SUMS.txt](https://github.com/xikan0/dsh-outerwilds-theme/releases/download/0.1.3/SHA256SUMS.txt)。

## 已完成的检查

- 审查实现与需求，清理重复发布白名单项和已失效的手动共享提示；保留必要注释与兼容代码，未在收尾阶段扩大重构范围。
- 类型检查、45 项测试、构建、包内容检查与发布预检查全部通过。
- 正式客户端与用户已验收的 beta.7 客户端 SHA256 一致，保留波形、显示屏外观及固定参数：增益 0.7、收束 250 ms、高度 100%。
- npm Trusted Publisher 已通过真实发布验证：OIDC 令牌交换返回 HTTP 201，自动生成 GitHub Actions provenance。
- runner 下载 npm 与 GitHub 的安装包，确认包校验值相同，并分别记录 `npmSubmitted`、`npmVerified`、`githubVerified` 为 `true`。
- 本地独立查询 npm 指定版本与 `latest`、GitHub 指定 Release 与最新 Release、标签指向与中文发布说明；全部符合正式发布提交。
- 本地独立下载 npm 安装包、GitHub 安装包和校验文件；包 SHA256、npm SHA512/SHA1、GitHub 附件 digest、包内客户端及校验文件内容均通过核对。
- `publication-evidence` 附件已下载，正式提交和包校验值与本地记录一致。

## 安装包校验值

两处安装包均为 11,022,320 字节（约 10.51 MiB），原生音频程序为 32,256 字节，已包含在包中。

| 项目 | 校验值 |
| --- | --- |
| 安装包 SHA256 | `32164fc4f806f8b46a07df4b5b04eeefdd601675146c2afbe2d01a8bdcb1297e` |
| 安装包 SHA1 | `3b2856033833f57a98caec2ce381fac68c50a480` |
| npm integrity | `sha512-5fMV091Qantf0iqacOdF0SOoW5QOLvFTIC4xTXZXXpWR4DqRwswNt3ElcIr49eLb0vIBkEdBUB96bjuWWDErKQ==` |
| 客户端 SHA256 | `b6e2aac48e1748dedae8e5a537ec35b825c466672b3dcc1393a78aeda500cc10` |
| 校验文件 SHA256 | `0cdb3ba857d158953f407542e1ceb4aed074bee7f8988cbccd92b05192988571` |

## 本地安装与验收范围

Web 与 Windows Desktop 的独立 profile 均已安装正式 0.1.3；安装时保留各自设置和其他插件。Web 保留音频响应关闭，Desktop 保留开启；运行检查确认 Web 未启动采集进程，Desktop 已启动音频组件。

用户已审查测试迭代的波形、侧栏外观和唯一设置开关，正式包客户端与已验收客户端一致。自动检查、安装与运行检查各自记录；没有据此扩大为其他设备、其他系统或默认设备切换的全面实际验收。完整变更见 [CHANGELOG](../CHANGELOG.md)。

## 本地证据

- `.sandbox/iterations/0.1.3-final/`：安装前备份、安装检查、包检查与运行检查。
- `.sandbox/release/0.1.3-ci-publication-38059386359/`：工作流附件及 `publication.json`。
- `.sandbox/release/0.1.3-publication-38059386359/`：两端下载包、校验文件及 `independent-verification.json`。

这些本地证据未随 npm 包发布；GitHub Release 长期保留安装包与校验文件，Actions 附件按工作流设置保留 30 天。
