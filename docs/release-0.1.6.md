# 0.1.6 正式发布记录

用户于 2026-10-20 在 Desktop 清理该主题历史配置并重新安装 0.1.6-beta.1 后，保持 DSH 原生深色，确认第一次点击“启用深色主题”成功。随后用户明确同意将修复版 0.1.6 发布到 GitHub 和 npm。

本版针对真实报错 `settings/rejected: No configurable plugin entry "ui-outerwilds-theme"` 修复启用前的宿主入口同步顺序，不将其与 0.1.5 的版本冲突混为一谈。变更见 [CHANGELOG](../CHANGELOG.md)，错误证据、真实宿主回归、首次安装环境重建与用户确认见 [测试记录](web-iteration-0.1.6.md)。README 保持长期有效的项目介绍。

已验收客户端 SHA256：`846fc25296c314aeb217204cf24679efd637eb62eb10dffcb4fe12383b472440`。正式构建必须保持相同客户端。本轮实际确认范围为 Desktop 首次启用；Web 完成安装运行核对，不扩大为其他场景的全面验收。

按 release.yml 手动入口，以明确提交、稳定版本和已验收客户端 SHA256 通过 npm OIDC 发布，同一份安装包用于 npm 与 GitHub。发布结果与线上独立下载核对待实际完成后补充；不会为发版再次重置或中断用户当前 Desktop。
