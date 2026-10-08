# 字体说明

主题启用时，界面英文、数字和代码文字使用 Jost，中文使用思源黑体简体中文地区版。字体随客户端打包，使用原有的字号、粗细和行高；关闭主题后恢复 DSH 原有字体。数学公式和终端使用各自排版所需的字体。

字体文件保持官方原样，没有修改字形或生成自定义子集。
源码中的字体位于 `src/assets/fonts/`，安装包通过 `lib/client.js` 内嵌这些字体。

| 字体 | 来源 | 随附文件 |
| --- | --- | --- |
| Jost 常规、斜体可变字体 | [Google Fonts 页面](https://fonts.google.com/specimen/Jost)、[官方字体仓库](https://github.com/google/fonts/tree/6e4b84c976cadb3c49a40fd9a1c203e4f7fcf2da/ofl/jost) | `Jost-Variable.ttf`、`Jost-Italic-Variable.ttf` |
| 思源黑体简体中文地区版可变字体 | [Adobe 字体说明](https://github.com/adobe-fonts/source-han-sans/blob/master/README-CN.md)、[官方 WOFF2 文件](https://github.com/adobe-fonts/source-han-sans/blob/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/Variable/WOFF2/TTF/Subset/SourceHanSansCN-VF.ttf.woff2) | `SourceHanSansCN-Variable.woff2` |

两套字体分别保留各自的 SIL Open Font License 1.1、版权声明和保留字体名称约定。完整许可见 [Jost 许可](licenses/Jost-OFL.txt) 和 [思源黑体许可](licenses/SourceHanSans-OFL.txt)。项目软件的 MIT 许可不适用于这些字体。
