# 篝火与星空
一个给 DeepSeek Harness（DSH）使用的主题，《星际拓荒》作为主题的聊天界面。

![预览图](docs/screenshots/preview.png)

- 篝火、烟雾和零星火星的小动效，也可以切换成完全静止。
- 背景随窗口大小调整，营地保持在右下角。
- 可以调整背景亮度、星星数量、面板透明度、字号和布局密度。
- 支持 DSH Web 和 Windows Desktop。

目前初版是 **0.2.11**，在 **DSH 0.2.0-rc.2** 的 Web 与 Windows Desktop 上完成了个人使用验收。其他系统和 DSH 版本还没有验证。

## 安装和启用

从 [Releases](https://github.com/xikan0/dsh-theme-campfire/releases) 下载 `dsh-theme-campfire-0.2.11.tgz`。

### Web

先安装 DSH，并确保终端能运行 `dsh`。在安装包所在目录运行：

```powershell
dsh plugin --profile web add ./dsh-theme-campfire-0.2.11.tgz
dsh web
```

如果 Web 已经运行，安装后需要重启。

### Harness Desktop

如果你的版本提供插件管理入口，在侧栏打开 **插件 → 添加插件**，填入下载的安装包的完整路径，例如 `C:/Downloads/dsh-theme-campfire-0.2.11.tgz`。安装并启用插件后，完全退出应用（包括托盘）并重新打开。

桌面版和 Web 的插件安装位置不同。命令安装请参考 [DSH 官方桌面端说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md#bundled-command-runtime)，使用桌面版随附的命令；旧版本可能不支持该方式，不要用 npm 版 `dsh` 修改桌面端的插件目录。

如果使用桌面版随附的 `dsh` 命令，先完全退出 Desktop，再在安装包所在目录运行：

```powershell
dsh plugin --profile desktop add ./dsh-theme-campfire-0.2.11.tgz
```

安装后重新打开 Desktop。

### 启用主题

打开 **设置 → 篝火与星空 → 启用深色主题**。首次安装默认关闭，手动启用后才会显示。

建议关闭其他完整主题、壁纸和自定义配色，以免相互覆盖。切换到浅色时，篝火场景会自动停用。

## 调整外观

| 设置 | 可以做什么 |
| --- | --- |
| 背景亮度 | 调整整个背景的明暗，默认 35% |
| 星星数量 | 少、标准、多；调整的是插画外的扩展星空 |
| 动效强度 | 静止、轻微、增强；只影响营地，星空始终静止 |
| 面板不透明度 | 调整输入框和菜单的透明程度，默认 96% |
| 正文字号 | 与 DSH 原生字号同步 |
| 布局密度 | 舒适或紧凑 |

设置修改后会立即预览。“恢复主题默认”会重置主题参数，保留启用状态和正文字号。

## 卸载

Web 端先关闭主题，再运行：

```powershell
dsh plugin --profile web remove dsh-theme-campfire
```

重启 Web 后生效。Desktop 请通过桌面应用自己的插件管理方式移除，再完全退出并重开。

## 想自己改一改

下载源码后，在项目目录运行：

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm pack
```

`npm run preview` 可以启动本地样例页，地址是 `http://127.0.0.1:3092`。它用来预览主题，不会调用模型。

## 关于素材

这是免费的非官方主题。软件代码采用 [MIT 许可](LICENSE)，背景图片不包含在 MIT 许可内。素材参考见 [ARTWORK.md](ARTWORK.md)。

