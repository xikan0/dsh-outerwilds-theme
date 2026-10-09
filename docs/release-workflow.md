# 正式发布操作

GitHub Actions 第一阶段发布流程于 2026-10-09 接入。继续由用户审查 Web 外观，助手在明确收到验收与发布指令后触发。版本号暂由本地收尾决定，semantic-release 的版本自动化按后续阶段接入。

## 开发与收尾

1. 本地 beta 安装、`--no-open` 重启与用户审查继续遵守 `AGENTS.md`。
2. 正式收尾时统一 `package.json` 和 `package-lock.json` 的稳定版本，并更新 README 和 CHANGELOG。
3. CHANGELOG 必须有该版本的 `## x.y.z` 小节及“验收”说明，明确 Web/Desktop 的实际范围。
4. 保存并推送正式收尾提交，记录完整 SHA 和已验收 Web 客户端的 SHA256。发布任务只允许该次 `main` 运行的提交。

## 演练与发布

工作流入口为 [Release](https://github.com/xikan0/dsh-outerwilds-theme/actions/workflows/release.yml)，默认 `publish=false`，只进行检查、构建、打包与 dry-run。正常推送和 PR 的 Verify 工作流只检查类型和测试。

对于已经发布的版本，npm 的 publish dry-run 也可能因版本占用而拒绝。此时演练与同包恢复跳过该操作，继续核对安装包，并在 `preflight.json` 明确记录；未占用版本仍必须执行 dry-run。

助手可通过 `gh workflow run release.yml --ref main` 传入以下字段：

| 字段 | 内容 |
| --- | --- |
| `version` | 已写入源码和 CHANGELOG 的稳定版本，如 `0.1.3` |
| `approved_sha` | 正式收尾提交的完整小写 SHA |
| `reviewed_client_sha256` | 已验收的 `lib/client.js` 的 SHA256；正式发布必填 |
| `publish` | 演练为 `false`，用户已批准正式发布时为 `true` |

SHA256 可用 PowerShell 获取：`(Get-FileHash -Algorithm SHA256 -LiteralPath 'lib/client.js').Hash.ToLowerInvariant()`。应核对它与 Web 实际安装、用户已验收的客户端一致，不能把一次新构建自动当作已经验收。

工作流固定 Node `24.21.0`、npm `12.2.0` 和官方 Actions 的提交。prepare 任务执行类型检查、测试、构建、打包及发布 dry-run，保存 `release-candidate` 附件。正式任务使用 OIDC 发布其中的 `.tgz`，再创建不带 `v` 的版本标签与 GitHub Release，最后下载两处的文件核对 SHA256。

附件包含安装包、`SHA256SUMS.txt`、中文发布说明和 `manifest.json`。正式任务另保存 `publication-evidence`，其中 `publication.json` 分别记录 npm 提交、npm 复核与 GitHub 复核结果。Actions 附件保留 30 天，正式 GitHub Release 长期保留包与校验文件。

## npm 可信发布设置

在下一次具备正式发布条件时，进入 [npm 包设置](https://www.npmjs.com/package/dsh-outerwilds-theme/access)，添加 GitHub Actions Trusted Publisher：

| 设置项 | 值 |
| --- | --- |
| Organization or user | `xikan0` |
| Repository | `dsh-outerwilds-theme` |
| Workflow filename | `release.yml` |
| Environment name | 留空，本工作流未使用命名环境 |
| Allowed actions | 启用直接 `npm publish`；当前流程不需要额外的 dist-tag 管理权限 |

无需向仓库添加 `NPM_TOKEN`。该工作流的发布任务已配置 `id-token: write`，GitHub 标签与 Release 使用短期 `GITHUB_TOKEN`。

按当前 [npm 官方要求](https://docs.npmjs.com/trusted-publishers/#trusted-publisher-configuration-expiry)，新配置需在两天内完成首次成功发布，因此不提前为尚未准备好的版本建立连接。首次真实 OIDC 发布前，演练通过不等于 npm 账号连接已验证。保留现有人工发布方式作为恢复路径。

## 失败与恢复

- prepare 失败时没有实际发布；根据日志修复，再重新运行。
- npm 处理可能延迟，脚本最多等待约五分钟；超时后先查线上状态，再运行同一提交的流程。
- 若 npm 已存在同版本，只有安装包 SHA512/SHA1 完全一致时才跳过 npm 发布并补齐 GitHub 步骤；不同内容会阻止流程。
- 若已存在版本标签，必须指向同一正式提交；GitHub 已有说明和附件也必须匹配，不自动覆盖。
- 如果最新版本已高于该任务的版本，流程会停止，避免降低 `latest`；此时单独补查缺失的 GitHub 结果。
- 发布失败日志保留在 Actions，助手核对具体步骤并报告；流程不自动给 Issue/PR 发消息，也不自动创建失败 Issue。

## 当前验证范围

第一阶段于 2026-10-09 完成接入，发布脚本与工作流提交为 `72492c531d04c9b1c67c6da92a8b4e12eaedf10d`。

- 本地类型检查通过，29 项测试全部通过；两个工作流通过 actionlint `1.7.12` 检查。
- 本地完整构建、打包与演练通过；候选包中的 `lib/client.js` SHA256 为 `23a3b32afe84e32b70bda1f84af77db52045c4f0aae8ae9e38b9833f85631db7`，与用户已验收的客户端一致。
- GitHub 托管 Linux runner 的 [Verify 检查](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/37876784093)通过。
- [Release 演练](https://github.com/xikan0/dsh-outerwilds-theme/actions/runs/37876781195)通过安装、类型检查、测试、构建、包内容与已验收客户端校验、线上预检查和附件上传；`publish=false`，正式发布任务跳过。
- 现有 `0.1.2` 已被占用，演练按设计跳过 npm publish dry-run。在隔离副本中用合成的 `0.1.3` 安装包、空 npm 配置执行新版本 dry-run，返回成功；随后匿名查询确认 npm `latest` 仍为 `0.1.2`，`0.1.3` 返回 404。

GitHub 上已保存 `release-candidate` 附件，runner 已完成包内容和校验值检查。本地下载该 CI 附件两次均因网络 `unexpected EOF` 中断，未完成下载后的独立复核。正式发布任务中的跨任务附件下载、真实 OIDC 认证、两处发布与发布后下载校验，仍需在下一次真实版本发布时验证。

本次接入保留 `0.1.2`，没有重复发布它，也没有为验证认证创建正式新版本。npm Trusted Publisher 账号连接按前述约定在下一次具备发布条件时配置；semantic-release 的版本计算留待第二阶段。
