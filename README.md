# dsh-loop-guard

Guard against repetitive tool-call loops with threshold-based interruption

> 由 [dshp](https://github.com/carbide4826/dsh-plugin-cli) 生成 · 依赖版本 DSH 0.1.7-rc.1

　　**版本跟随 dsh**:所有 `@deepseek-ai/dsh-*` 跟随 DSH 版本线,当前固定在 0.1.7-rc.1(0.1.7 线最新);后续随官方迭代跟踪更新。

　　**Node 要求**:`^22.19.0 || >=24.0.0`。

## 快速开始

### 1. 依赖安装到打包

```sh
pnpm install          # 安装依赖(①)
pnpm build            # 构建
pnpm typecheck        # 类型检查
```

### 2. 前置准备:项目内安装 dsh

　　在**本项目根目录**执行:

```sh
pnpm add -D @deepseek-ai/dsh@0.1.7-rc.1  # 安装 dsh(②)
```

### 3. 不启动,只检查

> 这里先用下面「方式二」的 `--patch` 做一次临时注入,确认插件行进得了组合树。

```sh
# 不启动,检查组合树里有本插件行:
pnpm dsh web --patch ./dev.patch.yml --dump-config | grep -A 4 dsh-loop-guard
```

### 4. 配置注入(两种,二选一)

　　两种方式都是让宿主知道有这个插件,区别只在「装产物」还是「直载源码」。

#### 方式一 · 插件 add(持久,走构建产物)

　　前提:第 1 步已 `pnpm build`(装的是 `dist/` 产物,loader 按 `exports` 解析)。

```sh
pnpm dsh plugin --profile web add .      # 在本项目根目录执行(③④⑧)
pnpm dsh web                             # 启动(全走构建产物)
```

#### 方式二 · --patch 一次性注入(临时,直载源码)

```sh
pnpm dsh web --patch ./dev.patch.yml  # 启动(直载源码)(⑤⑥)
```

> 开发期用 `--patch` 直载 .ts 源码;`plugin add` 装的是构建产物,两条轨道互不影响。

　　启动后打印 Web 地址(默认 http://127.0.0.1:3080)即代表 apply 已执行;功能级验证:工具在对话里让模型调用(需已配置模型),界面位打开 Web UI 对应位置查看。

### 注意事项（tips）

　　① **install 被祖先 workspace 劫持**:上级目录存在 `pnpm-workspace.yaml` 时,`pnpm install` 会被提升到该 workspace 根执行,本项目 `node_modules` 不生成(typecheck 报 Cannot find module);用 `pnpm install --ignore-workspace` 独立安装。

　　② **装 dsh 时放行构建脚本**:pnpm 会拦截依赖的构建脚本(供应链保护),按提示跑 `pnpm approve-builds` 勾选 `node-pty` / `koffi` / `@deepseek-ai/dsh-subprocess-local`;`@google/genai` / `protobufjs` 的脚本是 no-op,不用批。

　　③ **UI 界面位必须走 plugin add 才能渲染**:涉及 client 半边的界面位,`--patch` 直载只加载 host 半边、浏览器侧槽位注册不会发生(宿主按 npm 包身份聚合各包的 client 出口,file:// 直载没有包身份);必须先 `pnpm build` 再 `plugin add`。

　　④ **web profile 是共用的**:多个插件都 add 进 web profile 会互相污染;需要隔离时换成自己命名的 profile。

　　⑤ **dev.patch.yml 是生成物**:由 CLI 生成、内含本机绝对路径(机器私有),已在 `.gitignore` 中排除;不要提交,也不要手改。

　　⑥ **相对导入写全 `.ts` 后缀**:dev 直载走 Node 原生类型剥离,后缀须与文件字面一致(注册层 `.ts`、React 组件 `.tsx`)。

　　⑦ **项目身份是三个同名字段**:目录名(落盘位置)、`package.json` 的 `name`(包标识)、`src/index.ts` 的 `export const name`(Cordis 注册名)默认同值;改名要三者一起改,并同步 `cordis.patch.yml` 的 `- id:`(插件 id)与 `name:`(模块名,默认与包名同值),漏一处即身份错位(UI 案例另有 `tsdown.config.ts` 内的 client id)。经 `dshp create` 生成时已自动重写,无须手动同步。

　　⑧ **改代码后要重新 build + 重新 add**:`plugin add` 装的是构建产物,改完源码不会自动生效——需重新 `pnpm build` 后再执行一次 `pnpm dsh plugin --profile web add .`(想边改边看走「方式二」直载)。

### 代码结构

```
src/index.ts        插件入口(name/inject/apply)
```

src/events.ts        事件域聚合
src/fingerprint.ts   指纹器(工具名+参数哈希,精确/归一两档)
src/domains/         各事件域监听(ctx.on)
