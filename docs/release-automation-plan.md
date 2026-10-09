# npm 发布流程优化方案

日期：2026-10-09。用户已确认按此分步方案推进；第一阶段已接入 GitHub Actions 与发布脚本，本地检查和 GitHub 托管 Linux runner 演练通过，保留手动版本收尾。实际操作与验证范围见 [发布流程](release-workflow.md)。npm Trusted Publisher 在下一次正式发布前配置，真实 OIDC 发布届时验证；semantic-release 的版本自动化按第二阶段接入。

## 建议

分两步推进：先用 GitHub Actions 与 npm 可信发布（OIDC）自动完成验收后的发布，再接入 semantic-release 自动计算版本与生成变更摘要。Web 测试、用户审查和 `--no-open` 启动约定继续沿用 `AGENTS.md`。

semantic-release 根据提交信息计算版本，调用插件发布 npm 包与 GitHub Release；OIDC 则解决 CI 的 npm 认证。两者承担不同职责。官方提供 [GitHub Actions 接入方式](https://semantic-release.org/recipes/ci-configurations/github-actions/)；[npm 可信发布](https://docs.npmjs.com/trusted-publishers/)允许指定工作流使用短期身份凭据，无需维护 npm 发布令牌。

## 方案制定时的仓库状态

- npm 名称为 `dsh-outerwilds-theme`，当前正式版本为 `0.1.2`，仓库为 `xikan0/dsh-outerwilds-theme`。
- 没有 `.github/workflows` 和 semantic-release 配置。
- 现有正式标签为 `0.1.0`、`0.1.1`、`0.1.2`，还保留历史标签 `v0.2.11`。
- 最近提交为普通描述句，尚未使用默认分析器识别的 `fix:`、`feat:` 等格式。
- `package.json`、锁文件、README、中文 CHANGELOG 和 Web 迭代记录由本地收尾流程维护。
- `prepack` 调用构建；客户端构建使用包名，不嵌入包版本。制定方案时 Windows 本地检查已完成，Linux CI 尚未验证；第一阶段接入后已通过 Linux CI 演练。
- 0.1.2 已完成人工发布与线上包校验；本方案用于后续版本。

## 第一步：验收后触发一次发布

拟新增一个 `release.yml`，采用 `workflow_dispatch` 手动触发。用户确认审查通过并允许发布后，助手触发流程，无需用户逐个执行 npm 和 GitHub 命令。

1. 输入正式收尾提交的完整 SHA，限定 `main`，确认它与该次运行的提交一致；记录它对应的 Web 验收迭代。发布按固定提交执行。
2. 从锁文件安装依赖，执行类型检查和现有测试；构建正式包，检查包名、版本、文件范围及尚未占用的 npm 版本。
3. 打包一次，保留 `.tgz`、SHA256、发布说明与版本/提交清单；先完成 npm 发布 dry-run。
4. 用 npm OIDC 发布这份 `.tgz`，再创建 Git 标签和 GitHub Release，上传同一份安装包与校验文件。
5. 等待 npm 处理完成，核对版本与 `latest`，下载 npm 和 GitHub 包复核校验值，保存结果与发布记录。
6. 同一包的发布任务串行运行；部分步骤失败时，先确认已完成的操作再补齐，不能靠再次发布同一 npm 版本恢复。

保留现有手动版本收尾和中文发布说明。这一步就能覆盖此次手工发布的大部分操作。

拟配置 npm Trusted Publisher：用户 `xikan0`、仓库 `dsh-outerwilds-theme`、工作流文件 `release.yml`，启用直接 `npm publish` 权限。使用 GitHub 托管 runner 和 `id-token: write`，GitHub 发布使用工作流的 `GITHUB_TOKEN`。目前尚未核对该包的 npm Trusted Publisher 设置。

按当前 [npm 文档](https://docs.npmjs.com/trusted-publishers/#trusted-publisher-configuration-expiry)，新建的可信发布配置需在两天内完成首次成功发布；因此等下一版具备发布条件时再配置。dry-run 和 `npm whoami` 都不能证明 OIDC 实际发布权限已验证。

## 第二步：接入 semantic-release

- 以现有 `0.1.2` 为版本基线，配置 `branches: ['main']` 与 `tagFormat: '${version}'`。默认格式带 `v`，需要显式调整以识别现有正式标签，避免将历史 `v0.2.11` 用作基线。参见[标签与已有版本配置](https://semantic-release.org/usage/configuration/#existing-version-tags)。
- 从下一轮开发开始使用提交约定：`fix:` / `perf:` 升补丁版本，`feat:` 升次版本，破坏性变更升主版本，纯文档与日常维护默认不触发发布。提交正文可继续使用中文，不改写历史提交。自动版本意味着新功能不一定沿用 `0.1.x`；默认规则下，`0.1.2` 之后的新功能会生成 `0.2.0`。参见[项目说明](https://github.com/semantic-release/semantic-release#commit-message-format)。
- 先预览计算出的正式版本，在本地完成 `package.json`、锁文件、README 与中文说明收尾；CI 核对预览版本与收尾版本一致。默认 semantic-release 不会将包版本写回 Git 仓库，本方案保留本地元数据收尾，避免引入发布机器人回写分支。参见[版本维护说明](https://semantic-release.org/support/faq/#why-is-the-packagejsons-version-not-updated-in-my-repository)。
- 本地 Web beta 继续使用独立迭代版本，不把每次视觉优化都发布到 npm。初期继续在验收后手动触发；若以后改成合并自动发布，应让正式分支只接收已验收的改动。手动触发是针对本项目视觉验收节奏的选择，官方主要推荐持续交付。
- 保留人工精修的中文更新说明和 Web/Desktop 验收范围；自动提交摘要作为补充，不代替实际验收记录。
- 保留“一份安装包用于两处发布”。核对的 [npm 插件源码](https://github.com/semantic-release/npm/blob/master/lib/publish.js)默认发布目录，而不是直接复用 `tarballDir` 中的包；本项目可用 npm 插件仅更新版本并打包，再通过 [exec 插件](https://github.com/semantic-release/exec)调用脚本发布指定 `.tgz`，最后让 GitHub 插件上传该文件。
- GitHub 插件关闭 Issue/PR 评论、失败自动建 Issue 和标签修改：`successComment: false`、`failComment: false`、`failTitle: false`、`releasedLabels: false`。发布通知保留在当前任务与 Actions 状态中。选项参见[插件文档](https://github.com/semantic-release/github#options)。

本次查询 npm 得到 semantic-release `25.0.9`、npm 插件 `13.2.0`，Node 要求均为 `^22.14.0 || >=24.10.0`；后续接入时锁定依赖与满足要求的 CI 运行时，不直接使用未固定版本的临时安装。

## 实施与验证顺序

1. 先补齐不发布的 CI 检查，以及构建/打包/校验脚本，验证托管 runner 可用。
2. 添加验收后手动触发的工作流，使用已有包身份和不带 `v` 的标签格式。
3. 下一版可发布时配置 npm Trusted Publisher，通过一次真实发布验证 OIDC 与附件一致性。
4. 再接入提交格式检查和 semantic-release 发布预览，确认是否接受版本号自动决定。

semantic-release 的 [dry-run](https://semantic-release.org/usage/configuration/#dryrun)只预览版本和说明，跳过 prepare、publish 等步骤；构建、打包与实际发布验证需要分别完成。

若希望保留自己决定版本号的方式，第一步可以作为长期流程；semantic-release 的新增价值主要是版本与提交摘要的自动化。
