# dsh-loop-guard

Guard against repetitive tool-call loops with threshold-based interruption.

[English](https://github.com/carbide4826/dsh-loop-guard/blob/main/README.en.md)

> 由 [dshp](https://github.com/carbide4826/dsh-plugin-cli) 生成 · dsh 插件命令行脚手架

dsh 插件:检测模型对同一工具的重复调用,先提醒、再拒绝执行、必要时直接结束这一轮对话。

## 工作原理

每次工具调用都算一个签名(由工具名和参数决定:同样的工具、同样的参数 = 同一个签名)。签名记进每个 agent 最近 N 次调用的清单里(N = capacity,记满就挤掉最旧的一条,数的是调用次数不是时间)。看同一个签名在清单里出现几次,分三步处置:

- 出现到 threshold-1 次:往对话里插一条提醒,告诉模型"这个调用刚做过,换个参数或别再试了"
- 出现到 threshold 次起:这个调用在真正执行前就被拦下,工具不跑,模型收到一条"重复调用被拒"的错误
- 同一签名攒到 terminateAt 次:直接掐掉这一步、结束这一轮对话,省掉后面所有对模型的调用(那才是最烧 token 的部分)

几条不误伤正常工作的设计:

- 用户中途插一句话,该 agent 的清单就清空重来
- 换了参数就是不同签名、各记各的:好处是"每轮微调一点"的正常任务不会被误判;代价是那种"每次只改一点点参数"的死循环数不到(有意接受)
- 在 exempt 清单里列出的工具完全不参与计数,上面三步对它一律不生效

**提醒:对话有时会"戛然而止"。**

- 现象:签名攒到 terminateAt 次时守卫直接结束这一轮,模型来不及说收尾的话,界面上工具行之后突然安静——像无故中止,实际是终止线在工作
- 判断:打开轨迹页或点开工具详情,有 loop-guard 的提醒行或被拒的工具行(文案含 blocked repeat)就是守卫在拦,没有就是别的原因
- 恢复:会话没有被锁死,发任何新消息计数清零,对话照常继续;"停得明白"的改进见下方后续更新

## 配置

```yaml
config:
  granularity: normalized   # exact=参数原样参与哈希;normalized=归一后哈希(默认)
  capacity: 12              # 必填,滑窗容量,整数 >=1
  threshold: 3              # 必填,命中阈值,整数 >=2 且 <=capacity
  terminateAt: 8            # 可选,终止线,整数 >threshold 且 <=capacity;不写=不启用终止
  exempt:                   # 可选,豁免清单,按前缀匹配签名(写工具名即豁免其全部调用)
    - bash
```

capacity/threshold 必填且没有默认值:缺了会在插件装载期直接抛错并指名缺哪个字段,这是刻意设计,不静默兜底。所有约束在装载期逐条校验,违规即拒载。

## 安装

### 官方插件管理页

在管理页的安装入口填以下任一项即可:

| 包源 | 填写内容 |
| --- | --- |
| npm 包 | `dsh-loop-guard@0.1.0` |
| GitHub 仓库 | `https://github.com/carbide4826/dsh-loop-guard` |
| 本地目录 | 本仓克隆到任意位置的绝对路径(如 `<你的目录>/dsh-loop-guard`) |

### 命令行安装

统一命令形态:dsh plugin --profile <name> add <包源>,参数原样转发给 pnpm 装进 profile。包源三种:

**1. npm 包(正式发布)**

```sh
dsh plugin --profile web add dsh-loop-guard@0.1.0
```

支持写死版本号，建议安装 0.1.0 以上版本。

**2. GitHub 仓库(未发布也能装,直接拉 git 源)**

```sh
dsh plugin --profile web add github:carbide4826/dsh-loop-guard
```

本仓在 prepare 钩子里挂了 tsdown,git 源安装时会在本机自动构建出 dist/。pnpm 默认拦这类构建脚本:按报错提示把对应 key 加进 profile 目录的 pnpm-workspace.yaml 的 allowBuilds,再重跑一次 add。

**3. 本地目录(开发中的仓)**

```sh
dsh plugin --profile web add /path/to/dsh-loop-guard   # 在本仓根目录可写 .
```

走的是构建产物:先 pnpm build 产出 dist/,改完源码要重新 build + add 才生效。

三种装法启动时都会按包内 dsh.bundle.patch 声明自动并入 cordis.patch.yml 注册行;开发期不想落 profile,可以用 dsh web --patch <file.yml> 做临时覆盖层(profile 层之后、同 id 整行替换,可重复传;patch 里 name 写绝对路径可直载 .ts 源码,改完即跑不用 build)。

装完/启动后要在 profile 的 cordis.patch.yml(或 --patch 覆盖层)里补 capacity/threshold:必填无默认,缺了装载期直接抛。启动打印 Web 地址(默认 http://127.0.0.1:3080)即代表插件 apply 执行成功。

### 装完第一次启动的红字

直接启动必然会看到这一条:

```
dsh: warning: 1 entry did not activate dsh-loop-guard (dsh-loop-guard): Error:
dsh-loop-guard: invalid capacity undefined — window size must be an integer >= 1
```

这是刻意设计,不是装坏了。本插件没有可填参数的界面(dsh 的插件配置页要求插件自带前端页面,纯后端插件只显示开关),参数只能写进 patch 层。三步:

1. 打开 profile 目录里的 cordis.patch.yml,就是报错里那份 node_modules 的同级文件(如 `<你的 dsh home>/profiles/web/cordis.patch.yml`)
2. 在末尾追加一段,数值按你的偏好填(`id` 必须保持 `dsh-loop-guard`:patch 按 id 定位、整行替换,才能覆盖发布层那条空 config;`name` 也要带着,替换是整行换;要开终止再补一行 `terminateAt`,取值必须大于 `threshold`):

   ```yaml
   - id: dsh-loop-guard
     name: "dsh-loop-guard"
     config:
       capacity: 12
       threshold: 3
   ```

3. 重启 dsh(启用 dsh-hmr 的 profile 保存即生效);不再出现 `1 entry did not activate` 即为成功

## 开发

```sh
pnpm install
pnpm add -D @deepseek-ai/dsh@0.1.7-rc.2   # 宿主 CLI,上面 dsh 命令用它(全局装有 dsh 则不必)
pnpm build                        # tsdown 产出 dist/
pnpm typecheck                    # tsc --noEmit
```

首次安装后按 pnpm 提示跑 `pnpm approve-builds`,放行 node-pty / koffi / @deepseek-ai/dsh-subprocess-local 的构建脚本。

仓内 dev.patch.yml 是方式 3 的本机 overlay(含绝对路径,已 gitignore,不提交)。

## 代码结构

```
src/index.ts          入口:Config 定义 + schema + apply(校验、建状态表、注册)
src/chain.ts          计数器:agent 定长滑窗 + 装载期参数校验
src/fingerprint.ts    指纹器:稳定序列化,exact/normalized 两档
src/warning.ts        告警消息构造(自建 loop-guard 消息来源)
src/events.ts         事件域聚合
src/domains/tools.ts  post-execute 计数+告警,pre-execute deny
src/domains/agent.ts  pre-step 清链与终止
```

依赖版本线跟随 dsh,当前 `@deepseek-ai/dsh-*` 固定在 0.1.7-rc.2。Node 要求 `^22.19.0 || >=24.0.0`。

## 后续更新

- **遗言步**(计划中):到终止线先放行最后一步,让模型对当前状态给用户一句总结,再把这一轮收尾。

## 更新日志

历次变更见 [CHANGELOG](https://github.com/carbide4826/dsh-loop-guard/blob/main/CHANGELOG.md)。

## 许可

MIT,详见 [LICENSE](https://github.com/carbide4826/dsh-loop-guard/blob/main/LICENSE)。
