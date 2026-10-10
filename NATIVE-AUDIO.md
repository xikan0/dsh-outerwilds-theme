# Windows 系统音频组件

插件包含一个 Windows x64 原生程序，用 WASAPI loopback 读取默认播放设备。它由 DSH 后台启动，不需要用户额外安装软件或运行环境。默认关闭，侧栏不显示模块；在“设置 → 星际拓荒 → 音频响应”中开启后，模块出现并自动监听。关闭后隐藏模块并停止监听。选择自动保存，重启后保留；旧版已保存的自动监听选择继续生效。

## 行为与边界

- Web 与 Desktop 共用采集和绘制代码，已完成本地 Web 与 Windows Desktop 测试迭代；实际设备兼容性仍需按使用环境验证。
- 浏览器接收六个频段的能量、音量和采样率；原始声音不写入文件、不上传，不采集麦克风。
- 自动模式监听 **DSH 所在电脑** 的默认扬声器／耳机。远程浏览器打开 DSH 时，显示的也是这台电脑的播放声音。
- 切换默认播放设备后重新连接；播放暂停或设备不再发送声音时，返回静音数据。
- 自动模式只在主题启用、模块显示、至少一个页面连接时运行。关闭主题、隐藏模块、断开连接或卸载插件会停止采集。页面意外关闭或网络断开后，最后一个连接的租约最多 3 秒过期。
- 多个页面共享一个采集进程。一个页面退出不会停止其他页面的连接。侧栏显示屏只展示频谱，不提供点击或键盘开关；音频响应统一由设置中的开关控制。
- 默认关闭和非 Windows x64 系统均不启动程序。后者开启模块后会提示自动监听需要 Windows x64，不会弹出浏览器共享请求。
- 通信走 DSH Connection 的 `/api` 音频接口，不增加监听端口；沿用 DSH 的 Host/Origin 检查和登录认证。

## 构建与验证

`native/loopback.c` 是本项目的 MIT 源码，按 Windows 官方 WASAPI 接口实现。没有复制第三方项目的音频采集实现代码。二进制仅依赖 Windows 自带 DLL；Zig 仅用于开发构建，编译器不会放进安装包。工具链支持代码的许可一并保留在 `licenses/MinGW-w64-COPYING.txt` 和 `licenses/Zig-MIT.txt`。

使用 [Zig 0.15.2](https://ziglang.org/download/) 编译，可用环境变量 `OUTERWILDS_ZIG` 指定编译器路径：

```powershell
$env:OUTERWILDS_ZIG = 'C:/Tools/zig/zig.exe'
npm run native:build
npm run typecheck
npm test
npm run build
```

源码、二进制 SHA256、目标平台、编译器版本写入 `native/bin/manifest.json`。仓库固定 C 源码使用 LF 换行，避免不同系统检出时改变校验值。普通构建核对源码与二进制的 SHA256，复制到 `lib/native/`，无需临时下载编译器。修改 C 源码后必须重新编译。安装包携带对应 manifest，启动前再次核对程序 SHA256。

`outerwilds-audio.exe --self-test` 在内存中合成静音和六个音调，输出分析数据，不播放声音。真实系统音频的播放、暂停及设备切换仍需实机验收。

接口参考：[Microsoft WASAPI loopback recording](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording)、[IAudioCaptureClient](https://learn.microsoft.com/en-us/windows/win32/api/audioclient/nn-audioclient-iaudiocaptureclient)。
