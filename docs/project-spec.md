# Embodied DeepSeek Harness — Project Specification

版本：v1.3 · 2026-09-07
状态：架构与产品设计基线；尚未实现或完成运行验收。
项目名称：Embodied DeepSeek Harness（EDH）。

本文将已确认需求整理为可实施的设计。标注为“v1 默认”的内容是为实现确定的初始选择，可通过配置或后续设计决策调整。具体模型 checkpoint、算力和真机型号属于部署绑定项，不阻塞框架规格。

本版补充：第 17 节加入 Step 00–16 的逐步 implementation plan，明确前置依赖、实施动作、交付物、验收门槛和进度交接；保留 Team / Role、完整 Tool Catalog 与 SVG 架构图的设计基线。

阅读顺序：新接手的 agent 从第 0 节开始；第 1–3 节说明定位与架构；第 4–8 节定义 agent、通信、执行、验证和经验；第 9–11 节说明适配、工具与 team 定义；第 12–16 节给出迁移、验收、参考依据及工作包；第 17 节给出实际施工顺序，实施时按该节逐步推进。正文完整保留架构与协议说明；图示全部以 SVG 图片显示，交接时连同 assets 目录即可保留完整视觉说明。

## 0. 新接手 Agent 的工作交接入口

### 0.1 当前工作与下一步

用户已经完成项目方向讨论；接手实施时，任务是依照本规格实现框架，不再重新选择 agent 内核。**先完成 DSH 必要实现的选择性吸收与运行接入验证，再实现 Team / Role、Tool 和 CPU 事件闭环；不要一开始安装整套仿真/GPU/机器人依赖。** 本文给出产品定义、约束、拟实现接口、源码定位、实施顺序与验收标准。第 16 节列出首批工作包，第 17 节给出从 Step 00 开始的详细实施计划。

本文件描述目标设计；当前只有骨架中的接口、协议来源与样例，列出的工具、loader、CLI 和 provider 尚未实现。规格中的伪代码和 YAML 是实现契约，不是可直接调用的现有接口。

| 已有资产 | 当前状态 | 接手时如何使用 |
| --- | --- | --- |
| 本规格 | v1.3 实施设计基线 | 优先于旧讨论记录；用户后续明确修订优先于本规格 |
| 旧 EAF | 实际旧代码；基线 `714e00ca83999da2df7221dcf205968adde5b441` | 参考工具/策略/证据设计，保留旧仓库，不覆盖式改造成新项目 |
| DSH 官方代码 | 已做关键路径静态调研；基线 `d347e703908d0406b7a7ef80e3a0e594d86b2215` | 选择性吸收固定版本的必要实现；本仓库记录来源 |
| 控制面板 demo | 用户已认可方向；全部合成演示数据 | 复用布局意图，生产数据接入后再评估细节 |
| EDH 模块骨架 | 接口、定义样例与文档已建立；运行功能未实现 | 以实际模块和进度文档为准 |
| 模型/仿真/真机评测 | 本设计工作未执行 | 测试替身验证不能写成真实环境或机器人验证 |

### 0.2 仓库与工作区

仓库：[Embodied-DeepSeek-Harness](https://github.com/jixinyan/Embodied-DeepSeek-Harness)。
所有开发路径以本仓库根为准。EDH 是主体，选择性吸收 DSH 的必要实现，
不将完整官方仓库复制到项目中。来源版本与依赖审计见
[provenance](provenance/README.md)。原项目与历史 demo 是可选迁移资料；
接手所需的确认设计、图示和配置样例已包含在仓库中。

本地开发接续当前 checkout，不在临时调研目录里工作。骨架交付状态见
[progress](implementation/progress.md)。DSH 运行时尚未集成；不得因目录与
类型已建立就宣称完成 Step 00 的运行验证。

### 0.3 不依赖对话的实施决策

- Runtime 固定 DSH，TypeScript Host + 可选 Python worker；没有 Deep Agents/LangGraph 的第二套 agent loop。
- 组合单元是用户定义的 team 和 role；内置 planner/verifier/evolver 只是默认 role pack。用户增加场景分析员等角色不需要修改调度核心。
- 每次新委派创建新会话，调用方发送充足 InvocationBrief；每个实例独立的工作文件、工具视图与消息上下文。
- 所有工具进入 Catalog；策略执行只是其中一类。感知模型是可插入工具，不必变成 agent。
- 上层决策角色独占 retry/replan/resume；verifier 可暂停并验证；预算耗尽必须进入正式验证。
- GT 的限定检查结果可见，完整隐藏状态只供调试；evolver 不能通过证据存储绕过此边界。
- Retry 启动恢复记录，恢复目标经 verifier 确认成功后才提炼成功经验。
- 第一版仿真优先，硬件接口有测试验证；真机与策略微调后置。

### 0.4 接手后的第一次工作报告

先确认读取到的仓库 commit、工作区改动、当前已存在模块与本规格版本。随后报告选中的第一个工作包、会修改的位置和可在当前环境执行的验收。真实 checkpoint 缺失不阻塞纯协议/Team/Tool 工作；会影响真实运行的缺项明确保留，不伪造完成。

更新的进度记录至少含：已完成工作包、实际修改文件、运行过的测试命令与结果、未执行项及原因、下一工作包。除非用户要求，不擅自启动真机、发布软件、上传私有运行数据或覆盖旧项目。

## 1. 项目定位

构建一个基于 DeepSeek Harness（DSH）的开源具身任务框架：用户用简洁的 role 定义和 team 配置组织自己的 agent 团队，通过物理控制面板下达任务。上层 VLM 使用规划、工作文件、通信、感知、主动观察及执行工具，在仿真或真实设备上完成长程闭环任务。Verifier 异步观察执行、反馈并验证结果；上层独占重试和重规划决策；Evolver 在重试发生后追踪恢复过程，将经验证的成功恢复提炼为可复用的 `SKILL.md`。

框架的主要用户是具身智能研究者、策略/环境适配开发者及需要观察和调试长程机器人任务的使用者。

典型任务：“把桌上的杯子放进柜子”。同一任务在不同环境或机器人上使用相同的语义目标与通信协议，通过具体适配器绑定对象、传感器、控制接口和验证条件。迁移的是任务组织与经验；策略和硬件的兼容性仍需检查。

### 1.1 核心亮点与可验证主张

| 亮点 | 具体设计 | 如何证明 |
| --- | --- | --- |
| 基于 DSH 的物理闭环 | 复用 agent 内核，补齐异步执行、设备反馈、验证门槛和物理事件 | 跑通一次完整长程任务及失败恢复，不另建 LLM 循环 |
| 用户可定义的 Agent Team | 一个 ROLE.md 描述职责与工具，一个 team.yaml 组织成员和责任绑定 | 用户新增/替换角色只改配置，不修改固定 agent_type 或核心路由 |
| 完整且开放的工具能力 | 同一 Catalog 接入规划/文件、SAM 类感知、主动观察、策略与验证等工具 | 用现有工具组成新 role；新增一个感知 provider 后所有兼容 role 可选择使用 |
| 独立上下文、显式协作 | 每次新委派创建新会话；调用方发送完整任务包；消息支持点对点与订阅 | 隔离测试证明 agent 只获得显式收到或读取的信息 |
| 并行执行与验证 | 策略执行时 verifier 持续观察；可暂停；预算耗尽必进入验证轮 | 展示执行、监控、暂停确认和最终 verdict 的关联时间线 |
| 从成功重试中学习 | retry 触发 evolver，恢复成功才产生成功经验 | 能从 SKILL 追溯失败、改变、重试与成功证据 |
| 策略、环境、设备可替换 | 语义契约与硬件/仿真实现分离，声明兼容条件 | 接入第二种配置时不修改通用核心 |
| 物理任务可观测性 | 控制面板呈现 sensor、agent、设备、消息、证据与经验 | 用户能解释机器人为何停止、谁决定重试、用了哪条经验 |

这些是项目的工程目标与待验证主张，不预先宣称学术首创或跨环境泛化已实现。

## 2. 范围与不可变原则

### 2.1 已确认原则

1. **沿用 DSH 内核。** Agent 创建、模型循环、会话、工具和生命周期优先复用 DSH；新增领域插件与 UI 扩展。Python 执行服务不另建一套 agent 内核。
2. **所有 agent 上下文独立。** 不 fork 调用方历史，不自动复制其 system prompt、对话、工作记忆或其他 agent 的上下文。每次新委派从新会话开始，由调用方通过消息提供足够信息。
3. **同一次委派允许积累自身收到的信息。** 持续运行的 verifier 或 evolver 可以保留本次任务内的观察与消息；新委派/新实例不继承这些内容。如需接续，由调用方发送明确交接包。
4. **上层 VLM 决定重试、重规划和恢复执行。** 策略 provider、verifier、evolver 和框架事件处理器不得自行启动新的任务尝试。
5. **验证属于 verifier agent。** 仿真 GT 是其事实工具；不是绕过 verifier 的隐式任务判决。
6. **Verifier 异步监控，可暂停执行。** 预算耗尽必须触发正式验证；暂停请求与设备确认暂停分开记录。
7. **Evolver 由 retry 触发。** 成功经验以 verifier 对恢复目标的确认作为依据，服务上层与 verifier；不要求 VLA/VLN 直接消费 Markdown。
8. **Agent 以 Team / Role 方式可组合创建。** 用户定义职责、工具与输出方式，并在 team 中绑定成员；默认角色是模板，通信协议不硬编码 planner/verifier/evolver 或 manip/nav 枚举。
9. **覆盖仿真和真机。** 第一版先跑通仿真并验证硬件接入接口，真机实测后续推进。
10. **经验不能改写任务标准。** 用户目标与 benchmark evaluator 的权威条件保留来源和版本。
11. **工具是一等扩展点。** 规划、工作文件、感知、主动观察、通信、执行、验证与经验均可供角色选择。按实际副作用调度，不能把“perception”标签等同于无物理动作。

### 2.2 第一版交付边界

| 第一版交付 | 后续扩展 |
| --- | --- |
| DSH 集成、Team/Role loader、独立 agent 会话、通用任务消息与事件路由 | 更复杂的跨主机 agent 部署与工作流恢复 |
| 规划/工作文件基础工具、可插入感知与主动观察工具、统一 Tool Catalog | 更多感知模型、用户 tool packs 与扩展市场 |
| 默认 planner + verifier + 按恢复链创建的 evolver | 更多角色、多个专业 verifier 与多机器人协作 |
| 一个真实运行的仿真环境闭环；优先复用 BEHAVIOR 路径 | RoboCasa、RoboTwin 等更多环境的完整适配 |
| 以第二种运行配置检验接口，区分测试后端与真实环境适配 | 更广泛跨环境/embodiment 迁移评测 |
| 可替换 subgoal policy 接口、异步执行与硬件接口契约测试 | 策略微调、真实机器人实测、其他控制策略 |
| GT 辅助 verifier、运行中监控与正式验证 | 面向真机的视觉/传感器证据 provider |
| retry → evolver → 有证据的 SKILL → 后续检索 | 更大规模自动经验评估与跨配置验证 |
| 已认可 demo 方向的生产控制面板 | 遥操作、更多机器人专用面板 |

第一版上层聚焦具身任务、运行分析和经验管理，保留通用工具扩展。暂不将通用 coding assistant、在线训练、直接向 VLA 注入 SKILL、time-to-go 预测头或任意插件热替换列为验收要求。

## 3. 总体架构

![Physical Harness 框架总览](architecture/assets/framework-overview.svg)

[单独打开架构总览 SVG](architecture/assets/framework-overview.svg)

图中的实线表示配置、任务或控制路径，虚线表示观察、反馈或经验路径。三个编号层次分别是用户定义团队、DSH 独立角色会话、开放工具能力；下方展示物理执行与经验回流。各 agent 均有自己的上下文，连线表示显式调用和消息。



### 3.1 部署与模块分工

| 层 | 负责 | 边界 |
| --- | --- | --- |
| Control Console | 指令、运行状态、传感器、证据与经验展示 | 使用同一结构化事实来源，不从 agent 自述猜测设备状态 |
| EDH Host（吸收 DSH 运行能力） | LLM 调用、独立会话、工具、agent 创建与消息入箱 | 不负责高频动作步进 |
| EDH 领域模块 | Team/Role 定义加载、Tool Catalog、消息 schema、任务路由、验证门槛、恢复关联、能力装配 | 不实现另一套 LLM loop，不替上层做重试决策 |
| Python Execution Worker | 接入 policy、推进动作、报告预算和设备状态 | 不自行启动新的任务 attempt |
| Environment / Hardware Backends | 仿真状态、设备连接、传感器和执行器 I/O | 不向通用协议泄漏环境私有类型 |
| Evidence / Memory Providers | 运行资料、明确可读事实、SKILL 版本与检索 | 被存储的信息不自动进入所有 agent 上下文 |

v1 默认一个任务一个 planner，负责用户任务的整个物理决策过程；上层交互和 physical planner 可由同一实例承担。扩展配置可以另设接待/任务协调 agent，但必须明确当前任务唯一的执行决策归属，避免两个上层同时发起动作。

DSH 原生能力负责创建与唤醒；自定义任务路由负责可组合图中的显式消息。DiMOS 是硬件后端的优先评估对象，不是强制依赖；其 agent 系统不替代 DSH。

## 4. Team、Role、Agent 实例与上下文交接

Team 是用户声明的协作组织；Role 是可复用的职责与工具配置；AgentInstance 是某个 role 为一次委派创建的独立会话。TeamMember 是 team 内稳定的寻址别名，同一成员可在不同 assignment 中拥有不同实例，不能将“同属一个 team”解释成共享上下文。

例如用户定义 `scene_analyst`，给它分割与深度工具，并将它加入家务 team。Planner 可通过 `team.delegate(member='scene_analyst', brief=...)` 请求识别多个杯子，接收结构化实体候选，而无需新增一套硬编码 subagent builder。

### 4.1 Agent 模板

模板在产品上称为 RoleDefinition，声明 `role_id`、职责说明、模型路由、prompt、工具能力、可选输出 schema 和生命周期。成员的订阅与责任在 TeamDefinition 中绑定。实例另有 `agent_id`、独立 `session_id`、`assignment_id`、`team_run_id`、任务作用域和调用关系。具体定义格式见第 11 节。

| 默认模板 | 输入 | 输出/可调用能力 | 不负责 |
| --- | --- | --- | --- |
| Planner | 用户任务、能力目录、显式观察、verifier 反馈、检索经验 | 计划清单、工作文件、感知/主动观察、Subgoal、执行/恢复/重试决定、team 委派、结果汇报 | 自行伪造正式验证结果 |
| Verifier | 目标和成功条件、当前 attempt、观察入口、相关 SKILL、检查权限 | 监控反馈、暂停请求、正式 verdict、必要事实 | 发起 retry、重规划或自行恢复策略 |
| Evolver | 原失败证据、恢复目标、上层改变、关联记录与后续事件 | 有证据的恢复经验、SKILL 新版本与摘要 | 控制机器人、改变当前任务标准 |

Planner 委派 verifier 时一次性给足任务包，并注册当前 attempt 的监控关系。预算事件唤醒的是这个已获得任务信息的 verifier。若实例不存在，需要新建时，触发器使用 planner 事先提交的明确任务包；不得靠继承 planner 对话补齐信息。

Planner 发起 retry 时，先准备 evolver 的完整交接包并登记恢复链。经验 agent 的启动不阻塞机器人执行：即使模型响应较慢，事件已经保存，之后可通过给定引用补读。

### 4.2 InvocationBrief：新委派的最小上下文

| 字段 | 内容 | 例子 |
| --- | --- | --- |
| objective | 被调用 agent 本次要完成什么 | “监控本次放置，结束后验证目标条件” |
| task_scope | task、goal、attempt，必要时 recovery 关联 | `task_42 / goal_store / attempt_2` |
| expected_output | 输出 schema 与收件方 | `VerificationResult.v1 → planner_1` |
| entities | 当前对象实例及绑定来源 | `object=cup_17; container=cabinet_2` |
| success_contract | 当前权威条件、版本、作用域 | `inside(object, container)`，来源为任务定义 |
| known_facts | 已知相关事实，带时间和证据 | 上一轮检查为 false；图像 `obs_101` |
| history_summary | 完成当前任务所需的最小历史 | 第一次执行后杯子仍在桌上；上层已决定改变指令 |
| changes | 本次相对此前的变化 | 更明确绑定左侧杯子；不是泛泛“再试一次” |
| evidence_refs | 可读取的证据/记录和观察流范围 | 指定失败片段、事件区间、相机 stream |
| tools_and_limits | 可用工具、任务权限与预算 | 可观察、GT 检查、暂停；不可执行新 subgoal |

调用方负责语义充分性；schema 只能检查字段与引用有效性，不能证明信息足够。接收方缺少必要信息时，发送 `context.request`，保持等待或明确返回 insufficient_context，不能虚构缺失事实。调用方可使用工具帮助收集材料，但必须形成明确消息。

共享证据存储是资料来源。被调用 agent 只能使用任务包列出的引用或在本次授权范围内主动查询的资料；每次读取都可追踪，不存在自动同步的“所有 agent 公共对话”。其他 agent 的观点应标为报告或假设，不能自动成为世界事实。

v1 采用 fresh spawn，不使用继承父会话的 fork。Agent 在同一委派内收到后续反馈不会被强制清空自身会话；新委派、新任务、重新创建实例均发送新任务包。实例崩溃后重建也通过显式状态/证据交接恢复。

**Fresh 对话不等于 role 装配已隔离。** 已调研 DSH agent-presets 的普通 child 路径可能加入父级 composition。本项目的 team factory 必须为目标 role 明确选择/构建目标作用域，并在新会话发布前装配其 prompt、工具和资源视图；不可仅调用默认 subagent spawn 就假定目标 role 已生效。实现先验证 DSH scoped factory/preset 接口，必要时写独立桥接插件，验收检查实际发给模型的工具列表及 prompt 中不含父 role 的专属内容。

## 5. 通用通信协议

### 5.1 MessageEnvelope

以下是拟实现协议示例，不是现有 DSH 原生 API：

```json
{
  "schema_version": "physical.message.v1",
  "message_id": "msg_120",
  "kind": "event",
  "type": "verification.completed",
  "sender": {"agent_id": "verifier_3"},
  "destination": {"topic": "task_42.verification"},
  "scope": {
    "task_id": "task_42",
    "goal_id": "goal_store",
    "attempt_id": "attempt_2",
    "recovery_id": "recovery_1"
  },
  "correlation_id": "verify_request_2",
  "causation_id": "execution_stopped_2",
  "sequence": 120,
  "created_at": "2026-09-06T12:00:00Z",
  "payload": {
    "status": "passed",
    "goal_contract_version": "1",
    "checks": [{"check_id": "inside_target", "value": true}]
  },
  "evidence_refs": ["obs_130", "gt_check_9"]
}
```

`kind` 为 command / event / request / response / artifact。`type` 是可注册、命名空间化的扩展类型。目标为具体 agent、服务或任务主题之一。非 agent 服务的 sender 使用 `service_id`。Scope 中并非每条消息都需要所有 ID；按事件 schema 校验。

runtime 写入/验证真实来源、任务权限和序号。模型不能通过 payload 冒充另一个 agent，消息正文不能更改自身权限。`correlation_id` 关联一组交互，`causation_id` 标识直接触发事件；时间戳用于新鲜度，不依赖墙上时间推断跨设备严格顺序。

### 5.2 事件与责任

| 类型 | 生产者 | 主要消费者 | 语义 |
| --- | --- | --- | --- |
| `agent.invoke` | 调用方 agent，经 runtime 校验 | 新 agent | 完整任务包，创建独立上下文 |
| `context.request / response` | 被调用方 / 调用方 | 对方 | 补充任务信息，不复制整段父历史 |
| `execution.started / progress` | 执行服务 | Planner、Verifier、UI | 实际执行状态 |
| `execution.pause_requested / paused` | 请求方 / 执行服务 | Planner、Verifier、UI | 意图与实际确认分别记录 |
| `execution.budget_exhausted / ended` | 执行服务 | 验证触发器、相关 agent | 停止原因，不等于目标失败 |
| `monitor.feedback` | Verifier | Planner、UI；恢复期间可送 Evolver | 进展/偏离/疑似完成，关联观察 |
| `verification.requested / completed` | 生命周期插件 / Verifier | Verifier / Planner、Evolver、UI | 正式检查及证据 |
| `retry.requested` | Planner | 执行服务、恢复路由 | 明确原目标、本次变化和失败来源 |
| `retry.started` | runtime 确认 retry 已接纳后 | Evolver、UI | 建立恢复链并启动记录，不能靠文本猜测 |
| `recovery.resolved` | 关联器依据 Verifier 的原目标 verdict | Evolver、Planner、UI | 明确原恢复目标已通过，或被放弃 |
| `experience.created` | Evolver 经 memory provider 持久化后 | Planner、上层经验管理、UI | SKILL 版本、范围与证据引用 |

### 5.3 路由、顺序与重连

v1 在 DSH Host 内提供 typed router，跨执行 worker 使用可版本化的请求接口和流式事件；不强制引入独立消息中间件。点对点通信与发布/订阅共享 envelope。正式请求和结果先持久化再投递，允许重复投递，消费者按 ID 去重。每条 task 事件流有稳定顺序；不承诺跨所有服务的全局总序。

接收确认仅表示消息被接纳，不代表 agent 已处理或设备已执行。物理执行同时使用 `execution_id` 和幂等键，重复请求不能导致重复运动。重连发现结果不明时查询执行状态；无法确认则反馈 unknown，由上层处理，不盲目重发动作。

传感器原始流不逐帧广播到每个 LLM。Agent 消息携带流引用、选取的帧或短片段；关键事件不能因丢弃旧帧而丢失。持久化物理事件与 DSH 模型实际看到的消息分别保留关联，支持追溯“当时系统知道什么”和“该 agent 当时看到了什么”。

## 6. Subgoal 与执行契约

### 6.1 身份与职责

- `task_id`：用户的一次任务运行。
- `goal_id`：稳定的语义子目标；改写指令仍可保持同一个 goal。
- `attempt_id`：上层授权的一次尝试；新 retry 必须新建。
- `execution_id`：执行服务接纳的实际 job。
- `recovery_id`：原失败目标与后续 retry/重规划的恢复关联。

一个 attempt 可以包含策略正常生成的多段 action chunk，但不包含执行 provider 自行决定的新一轮任务重试。恢复暂停且仍使用同一指令时，可以继续同一 attempt 的剩余预算；预算耗尽后不得自动续额。上层决定改变指令或重新尝试时创建新 attempt。

### 6.2 SubgoalRequest

必需信息包括：关联 ID、自然语言 instruction、实体角色绑定、需要的能力、成功条件引用、约束和预算。Provider 可由上层指定，也可由装配层在已声明兼容集合中绑定；不能静默替换为另一任务语义。

```yaml
goal_id: goal_store
attempt_id: attempt_2
instruction: 将指定杯子放入已经打开的柜子
entities:
  object: cup_17
  container: cabinet_2
required_capabilities: [object_manipulation]
success_contract:
  id: store_object
  version: '1'
  all:
    - check: inside
      args: [cup_17, cabinet_2]
budget:
  max_control_steps: 200
  max_wall_time_s: 60
context_refs: [observation_120, entity_binding_4]
```

200 步与 60 秒仅为示例，不是所有环境/策略默认值。Provider 必须声明控制步含义与频率；记录 policy 调用次数、实际控制步和仿真原始步，禁止把三者混为同一指标。Wall-time 是独立运行边界。

成功条件支持已注册检查及简单 all/any 组合。环境 adapter 将语义检查映射到具体 evaluator，记录定义和参数。不支持的检查明确报 unsupported；返回 false 与无法判定不可混淆。必要条件来自任务，而不是默认将“释放夹爪”等附加条件强加到所有 benchmark。

### 6.3 执行结果与正式判定分离

| 数据 | 字段示例 |
| --- | --- |
| ExecutionStatus | accepted / running / pausing / paused / ended；实际步数、设备状态、观察引用 |
| StopReason | policy_stop / budget_exhausted / verifier_pause / user_stop / backend_error / episode_terminated |
| VerificationResult | pending / running / passed / failed / unknown；逐项检查、证据、观察时间、条件版本 |
| PlannerDecision | resume / retry / replan / finish / abandon；明确引用反馈与新的目标 |

协议对“执行器自报成功”可保留 diagnostic 字段，但它不更新权威目标完成状态。正式 verdict 必须来自当前目标指定的 verifier，并与正确 attempt、条件版本和终止观察匹配。

### 6.4 预算、暂停与验证门槛

1. 执行服务接纳请求并返回 job 句柄，Planner 不阻塞等待整段 rollout。
2. 执行服务推进动作，提供观察和状态；Verifier 并行监控。
3. Verifier 可提出暂停；执行服务将其转换成后端支持的暂停/停止行为并确认。`pause_requested` 不得显示成 `paused`。
4. 预算耗尽时执行服务停止继续发动作，记录边界并强制发起正式验证请求。提前停止、异常和暂停也进入状态核对/验证收尾流程。
5. Verifier 使用该边界之后可获得的观察和 GT 检查；没有可靠新证据则为 unknown，不把旧监控结果直接冒充终局 verdict。
6. Planner 接收正式结果后决定下一步。未完成验证时不可当作成功继续任务；unknown 可以使上层请求补充检查或明确处理不确定性，不能静默当作 passed。
7. 恢复执行只能由 Planner 发起。不能原地恢复的后端以已停止报告；若需重启策略，由 Planner 创建新 attempt。

传输失败不允许自动重试物理动作；消息重投递与动作 retry 是不同层次。进程重启先查询设备与 job 状态。用户明确终止整个运行时可取消 agent 工作，验证记录标记取消/未知，不伪造完成。

## 7. Verifier：异步监控与正式验证

每次新委派的 verifier 有自己的新上下文，初始任务包包括：目标、判据、观察流、执行配置、必要历史及可读经验。一个实例可以在该委派期间从监控持续到正式验证；换实例必须显式交接。

### 7.1 执行中监控

支持最新帧、短时间片段及执行事件触发。v1 每个 verifier 同时最多一个模型请求，后到画面合并到下一轮最新观察；保留关键事件，避免排队处理越来越旧的图片。监控间隔、允许的观察滞后和模型预算由配置给出并在 UI 显示。

输出包括 progress、deviation、possibly_complete 或 insufficient_evidence，以及画面/事件引用。检测到疑似完成或明显偏离时可以暂停，最终是否完成仍需要正式验证。Verifier 不产生新 subgoal，也不替 Planner 选择重试策略。

“实时”指与执行并行的持续观察，不承诺每帧 VLM 推理或硬实时控制。设备本地控制与连接失效处理由硬件后端承担，不等待 VLM 网络往返。

### 7.2 正式验证与 GT 可见性

仿真中 verifier 调用限定目标的 GT check 工具，得到逐项结果和必要事实。Planner 收到这些检查结果与必要解释。完整隐藏场景状态仅供独立调试视图，不自动进入 planner/verifier/evolver 上下文；证据可见性应在 provider 层实施。

权威条件有明确 GT 结果时，verifier 的正式报告必须与其一致。协议门槛检查条件版本、检查覆盖与事实一致性，但不替 agent 选择观察或解释未知情况。可选诊断检查与任务必需条件分列，不能用经验中的额外偏好改变 benchmark 成功标准。

真机后续换用视觉/设备信号等 verification provider，同样保留 unknown。若需要移动底盘或机械臂获取新视角，由 verifier 请求上层决策；普通观察权限不自动授权改变物理任务。

v1 每个 goal/attempt 绑定一个最终 verdict 责任实例。扩展为多个专业 verifier 时，配置必须指定显式汇总者及规则，不能让多个互相冲突的 passed/failed 同时成为最终事实。

## 8. Evolver 与 SKILL 经验闭环

### 8.1 触发、输入与结束

普通执行始终记录运行资料，但不必启动 evolver。上层明确发起 retry 时，runtime 登记恢复链，调用方将失败证据、恢复目标、本次变化、可读记录和输出要求发给全新 evolver。

v1 每条 recovery chain 一个 evolver assignment；后续尝试通过明确消息和订阅进入其自身上下文。不同恢复链不共享上下文。若恢复链过长，可输出结构化交接包，由新实例接手。

恢复成功的依据是原恢复目标的正式验证，而不是某个前置子任务成功。例如重规划增加“打开柜门”，门开只能更新该子目标；原来的“杯子入柜”尚未验证时不得生成对应成功经验。多步恢复末尾由 Planner 请求对原目标复核。

失败或放弃时保存恢复记录，不生成“成功恢复”SKILL。策略自报成功、预算用完或人工文字声称成功均不替代 verifier 的结果。Evolver 异常不阻塞当前任务完成：保留待处理记录，后续以新任务包重新委派总结。

### 8.2 经验内容与归纳边界

SKILL 面向 Planner 与 Verifier，包含触发情形、可观察证据、决策启发、验证陷阱、适用前提及反例。设备坐标、关节序号、某个环境的对象实例 ID 不写入通用规则；原始数据保存在引用的证据中。

经验写入后可按其已声明范围检索，不要求逐条人工审批。成功来源、版本和适用条件必须完整；未经跨配置评测的条目标记 source_validated / transfer_unvalidated，不宣称通用能力已经验证。进一步检索到不兼容配置时返回不匹配原因，不能仅按任务名称自动套用。

一次“改变后成功”支持形成经验假设，不证明唯一因果。多个因素一起改变时如实记录；不把某一因素单独描述成已证明修复原因。

### 8.3 Skill bundle

```text
skills/
  reobserve-ambiguous-target/
    SKILL.md
    metadata.json
    references/
      recovery-evidence.json
      transfer-notes.md
```

`SKILL.md` 是面向 agent 的可读知识入口；`metadata.json` 保存结构化检索字段、版本、能力前提、验证配置、证据和状态。原始视频/轨迹不复制进 skill 文件夹，使用证据 URI。通过 provider 封装，可替换文件系统、索引或远程存储；DSH 原生发现与按需加载继续复用。

以下仅为格式示例，不是从真实实验得出的经验：

```markdown
---
name: reobserve-ambiguous-target
description: 当目标绑定不明确且一次执行未通过检查时，辅助上层重新观察与验证。
---

# 适用情形
画面存在多个相似目标，当前目标绑定证据不足，且本次目标检查未通过。

# 上层决策启发
先请求新的观察或明确目标绑定，再决定是否重试；不要仅重复原指令。

# 验证提示
核对被检查实体与任务目标身份一致；策略停止本身不能证明目标完成。

# 适用边界
需要能够取得有效新观察。不能据此推断所有抓取失败都由目标歧义造成。

# 来源
通过 metadata 与 references 关联完整失败—改变—成功恢复证据。
```

### 8.4 工作状态、资料与长期经验

| 类别 | 生命周期 | 谁能看到 |
| --- | --- | --- |
| Agent conversation | 单次委派 | 该 agent 自身；不自动传给别人 |
| Task facts / entity bindings | 当前任务，事实有时间与证据 | 经任务包、消息或明确查询提供 |
| Episode evidence / events | 持久化审计资料 | 有范围的引用读取，保留可见性 |
| SKILL library | 跨任务长期知识 | 显式检索、兼容筛选与按需加载 |

任务结束时上层收到结果与 recovery/skill 引用。下次任务的全新 agent 通过检索获得相关知识，而不是继承上一任务会话。

### 8.5 完整恢复时序

![异步执行、验证与成功恢复经验时序](architecture/assets/async-recovery-sequence.svg)

[单独打开恢复时序 SVG](architecture/assets/async-recovery-sequence.svg)

图中“向执行服务获取 GT”经过限定 verification provider，并非开放隐藏场景查询。若中途 verifier 暂停，必须先得到设备确认再检查；Planner 决定恢复同一 attempt 或启动新 attempt。图示的一次 verifier 委派覆盖该目标的连续监控，第二次尝试通过明确消息更新，不读取 Planner 的对话。

## 9. 可替换组件与适配契约

统一接口意味着明确输入、输出、语义与兼容条件，不意味着任意模型、设备和环境都能直接互换。接入失败应发生在预检阶段，并给出具体差异。

| 组件 | 必需契约 | 可选能力与替换检查 |
| --- | --- | --- |
| Model Provider | DSH 模型接口、图像/工具/结构化输出能力 | 不同 agent 可用不同模型；单独检查实际支持的输入形式 |
| Tool Provider / Catalog | 工具 ID、描述、参数/结果 schema、执行器、作用域、副作用与资源声明 | 原生 TS、Python/HTTP、MCP；角色只获得选择且兼容的工具 |
| Policy Provider | 接收 subgoal 与观察，输出动作/状态；声明版本及输入动作规格 | 所需相机、proprioception、控制模式、频率、支持的 instruction 粒度 |
| Embodiment Adapter | 设备/关节/传感器标识、坐标系、单位、动作与观察映射 | 固定臂、移动操作、双臂等能力组合；无导航能力不能接收导航任务 |
| Environment Adapter | 观察入口、实体绑定、运行来源、任务/evaluator 适配 | reset、step、snapshot、GT 为显式仿真能力，不强迫真机提供 |
| Hardware Backend | connect、状态、数据流、命令、停止反馈 | DiMOS、SDK、ROS2；暂停/恢复能力必须真实声明 |
| Verification Provider | 注册检查、条件版本、检查值/未知原因、证据 | 仿真 GT 与真机传感器证据可替换；不支持时不伪造 false |
| Memory Provider | 查询、写入、取版本、适用范围筛选、证据关联 | 文件系统/索引/远程存储；检索输出必须可追溯 |
| Agent Template / Router | InvocationBrief、输出 schema、订阅事件、独立上下文 | 任意角色扩展不改变基础 envelope；控制权限另行声明 |

### 9.1 观察与动作语义

Observation 描述至少包含 observation_id、capture time、源序号、stream/sensor/device ID、坐标系、数据引用、可见性和适用时的标定版本。多相机观测保留各自时间，不假装天然同步。Verifier 在请求中固定证据引用，图像更新不改变已发出引用对应的内容。

ActionSpec 声明机器人、关节顺序、单位、控制模式、频率和限位。Policy 的张量形状匹配只是第一层检查；例如两个七自由度机械臂可能关节顺序不同，夹爪开度的单位也不同。

v1 同一执行器资源只能由一个活跃 execution 占用；多个 agent 可并行观察与分析，但不能并行向同一机械臂发互相冲突的动作。资源管理属于 physical 服务，不能仅依赖单个 DSH agent 的工具串行规则。

### 9.2 仿真、真机与回放

三种来源均使用相同任务事件和观察展示契约，UI 明确标识来源。仿真运行可以推进物理时间并查询 GT；真机持续随真实时间变化；记录回放只能重现已记录观察和事件。

回放用于检查感知、verifier 输出、消息处理和经验提炼。它不能证明新动作会成功，也不能把旧动作日志重新发送到真机当作“恢复运行”。硬件断连后的 job 状态、设备状态和接管行为由后端明确报告；模型不会凭日志推断机械臂已经停止。

### 9.3 扩展示例

接入 RoboCasa：实现观察/实体/任务检查映射，绑定其机器人与兼容 policy，在相同 Subgoal 和 Verification schema 下运行契约测试；Planner、Verifier、Evolver 的基础协议保持不变。

接入真实机械臂：选择 DiMOS 或直接 SDK 后端，声明相机、关节、夹爪及停止能力，匹配 policy 输入和动作语义，再配置真机 verification provider。仅完成设备连接不代表 subgoal policy 已可用。

### 9.4 完整 Tool Catalog

下表的点分 ID 是拟实现的稳定逻辑 ID，不声称它们已经是 DSH 工具名称。Catalog 将所选条目注册为各自带 schema 的 model-facing tool，并记录逻辑 ID 与 wire name 的映射；不能为了统一而只给模型一个不透明的 `call_any_tool(name, string)`。

| Toolset | 最小工具能力 | 默认消费者 | 实现依据 |
| --- | --- | --- | --- |
| `planning` | `planning.read_plan / write_plan`、目标与依赖管理、完成条件关联 | 决策角色 | 旧 write_todos；复用 DSH todo 展示，补足持久 task plan |
| `workspace` | `workspace.read / write / edit / list / search`，任务工作笔记与中间文件 | 每个明确配置该 toolset 的角色 | 旧 Deep Agents 文件工具；映射 DSH fs/read/write/edit/search 能力 |
| `team` | `team.list_members / delegate / send / request_context / status` | Planner 与授权角色 | DSH scoped agent factory 与本项目 router |
| `perception.read` | `perception.capture / segment_objects / detect_objects / estimate_depth / localize`，读取点云等可选工具 | Planner、Verifier、用户感知角色 | 旧 capture_image、detect_objects、深度与 SAM adapter |
| `observation.active` | `observation.turn_view / look_at`，请求改变视角并返回新观察 | Planner；得到明确观察权限的用户角色 | 旧 rotate_camera 与相机/机器人接口 |
| `execution` | `execution.start / status / pause / resume / stop`，可选 gripper/reach 等 primitive | 按决策/暂停职责配置 | 已定义的异步 execution 与硬件资源服务 |
| `verification` | `verification.check_goal / read_evidence / submit_result` | 当前 final_verifier | 限定 GT provider 和正式结果协议 |
| `task_memory` | `task_memory.query / record_observation / bind_entity`，当前实体和空间事实 | Planner 与明确授权的角色 | 旧 scene graph / spatial memory，改为带来源的记录 |
| `skills` | `skills.search / load`、按适用条件取知识 | Planner、Verifier、其他显式配置角色 | DSH SKILL loader + 本项目检索 |
| `experience` | `experience.read_recovery / save_skill / report` | Evolver | 恢复链、证据与版本化 memory provider |

表中 perception 的条目按需出现；没有安装深度或分割 provider 时，不能显示成可用后返回假结果。用户可以接入 SAM3 类分割、其他检测器、深度模型或专有服务，不要求把这些模型包进 agent。固定 VLM 自己看图和调用外部感知工具可以并存。

### 9.5 上层核心工具与 Deep Agents 迁移

旧项目 `agents/top_agent.py` 装配感知与记忆工具，并依赖 `create_deep_agent` 提供 `write_todos`、`read_file/write_file/edit_file` 等基础工作能力。新项目保留能力，运行时换成 DSH；不能只迁移 policy tools 而删除上层规划与工作记忆。

| 旧能力 | 新版行为 | 特别约束 |
| --- | --- | --- |
| write_todos | Planner 能创建/读取/更新包含 goal ID、依赖、状态、成功条件引用的计划 | 计划状态是上层记录，不能代替正式 verifier 事实 |
| read_file / write_file / edit_file | 每个 assignment 有自己的文件工作区，保存 progress、分析和中间资料 | 没有通过消息提供的其他角色文件不能被读取 |
| 文件发现与搜索 | 只在本角色工作区和明确只读挂载范围搜索 | DSH fs-search 可直接调用子进程，不自动受 ctx.fs 限制；桥接层必须统一可见范围 |
| 委派 subagent | `team.delegate` 对 team 成员进行明确任务委派 | 不隐式继承父对话或父工具；返回 assignment/agent ID，不阻塞长任务 |
| 上下文压缩与持久化 | 复用 DSH 对当前 session 的能力 | 这是 runtime 能力，不是要求用户手动调用的“压缩工具”；压缩不能注入他人上下文 |
| 经验按需读取 | 检索并加载 SKILL，给出版本/适用条件 | 新任务独立上下文，知识通过显式工具结果进入 |

DSH 当前 `todo_write` 的列表属于单个 agent，其 UI projection 在新 turn 开始时清空。因此 **不能直接将该 projection 当作跨异步回合的任务计划数据库**。本项目维护 task-scoped `PlanDocument`，由 `decision_owner` 写入，包含 `plan_version` 与稳定 goal IDs；可向 DSH todo/UI 投影可读摘要。Verifier/Evolver 可以维护各自的工作清单，但不能更改 Planner 的权威计划。

PlanDocument v1 至少有 `task_id / version / owner_assignment_id / items[]`；item 包含 `goal_id / description / depends_on[] / status / success_contract_ref / last_verification_ref?`。计划写入用预期版本校验，旧消息不能覆盖新计划。`completed` 需要引用匹配条件版本的 passed verdict；草稿中尚未执行的目标不能借写 todos 变成已完成。

工作文件默认私有；跨角色交接文件时发送不可变 artifact ref，或显式只读挂载指定文件版本。团队共享的是协议和任务资料的可引用存储，不是任意角色可遍历的同一个可变 scratchpad。v1 不默认给每个 role 通用 shell；需要数字工具的用户 role 可显式选择对应 tool pack。

### 9.6 感知工具契约与 SAM 类接入

感知请求绑定已有 `observation_id` 和具体 frame，不用一个变化中的“latest image”隐式定位。结果至少包含 provider/model 版本、源观察引用、坐标约定、检测实例和证据引用：

```json
{
  "observation_id": "obs_120",
  "provider_version": "user-sam-adapter-v1",
  "instances": [
    {
      "detection_id": "det_4",
      "label": "cup",
      "score": 0.91,
      "bbox_xyxy": [0.12, 0.30, 0.28, 0.68],
      "bbox_space": "normalized_image",
      "mask_ref": "artifact_mask_4",
      "entity_id": null
    }
  ],
  "overlay_ref": "artifact_overlay_4",
  "depth": {"status": "unavailable"}
}
```

`detection_id` 不是稳定世界实体 ID，跨帧跟踪或实体绑定工具完成关联后才写 `entity_id`。没有深度、标定或可靠估计时不输出猜测的米制距离。感知置信度是 provider 的输出分数，不承诺已校准；不会自动成为 GT 真值。Mask、overlay、RGBD 的引用都可追溯回原帧，保留生成过程。

旧 SAM adapter 的实现与注释可以借鉴，但其具体模型 API 兼容补丁和依赖冲突必须重新确认，不能把旧 workaround 当成当前官方安装说明。v1 将 SAM 等重依赖做可选 provider/独立进程，未选择时不导入 GPU 包。当前规格不锁定 SAM 的某个模型版本；接入时锁定实际 checkpoint 与代码版本并运行契约测试。

### 9.7 主动观察是可调度的工具能力

`observation.turn_view` 表达“改变观察视角”，adapter 将它绑定到真实设备动作，不能仅凭工具名字认为无副作用。旧 EAF 的 `rotate_camera` 文案看似仅转相机，但 BEHAVIOR `motion.rotate` 实际使用底盘 yaw 和头部 pitch。

例子：桌面云台相机只需要锁定 `camera_pan_tilt`；R1Pro 的同类 yaw 观察可能需要锁定 `base`。如果当前策略正在使用底盘，观察请求必须排队或返回 resource_busy，由上层决定暂停或改变安排。不能在正在执行的策略旁边偷偷转动底盘。

输入声明观察意图、相机/实体引用、期望转角或 look_at 目标、调用预算；执行前解析实际 resource set 和 effect。结果返回 requested 与 achieved pose、完成/未完成原因、新观察引用和实际耗时/控制步。不得把收到请求视为相机已经到达。

主动观察工具的权限可在 role 与当前 InvocationBrief 中声明。默认 Planner 可调用；Verifier 默认可读观察、暂停和检查。如果 team 为 verifier 或用户感知角色配置主动观察能力，调用方必须在本次任务包授权允许的设备动作范围，且仍受资源调度。改变任务路线、重试或恢复策略仍由 decision_owner 决定。

主动观察计入独立 observation action 预算和任务总预算；不能隐藏其物理步以绕过 policy budget。验证阶段的新视角如果需要超出已授权范围的底盘/机械臂动作，向上层请求，不静默执行。

### 9.8 ToolDefinition 与接入路径

ToolDefinition v1 至少包括：`tool_id`、版本、描述、`input_schema`、`output_schema`、调用后端、effect 类型、需要的能力、资源解析方式、同步/异步生命周期及结果媒体类型。默认超时可由 tool pack 设置；物理动作另受任务预算约束。

```yaml
schema_version: physical.tool.v1
tool_id: perception.segment_objects
version: '1'
description: 在指定观察帧上按文本提示返回实例分割结果
input_schema: builtin:SegmentationRequest.v1
output_schema: builtin:SegmentationResult.v1
executor:
  kind: python_rpc
  provider: sam_local
  operation: segment_objects
effect: read_observation
required_capabilities: [rgb_observation]
resource_policy: provider_serialized
result_media: [json, image_ref, mask_ref]
```

接入提供三条路径：原生 DSH/TypeScript 插件；Python 工具 provider 的 RPC 包装；现有 MCP 工具桥接。对同一 model-facing tool，用户配置选择实现，例如将 `perception.segment_objects` 从 SAM provider 换为另一个分割服务，而不更改 role prompt。

原生工具执行器和外部工具桥都要走相同的调用记录与 role 可见性检查。MCP 自带的 schema 只是入口；物理副作用、实际资源、结果媒体和兼容性需要本项目的映射声明，不能默认所有外部工具都是只读。数据流仍不塞进普通 MCP 文本消息。

统一 ToolResult 至少区分 completed、running（带 operation ID）、failed 和 unknown（结果不确定）；记录 `tool_call_id / agent_id / assignment_id / tool_version / input_refs / output_refs / effect / actual_resources / error_code`。错误包括 invalid_input、unsupported、observation_stale、provider_unavailable、resource_busy、timeout、execution_state_unknown。只读推理失败可显式返回错误，物理动作超时必须先对账，不能自动重发。

工具声明的并发能力只用于初筛：SAM session 可能需要 provider 内串行，主动观察可能占用机器人；最终执行由解析出的真实资源决定。Catalog 的注册、role 选择、实际模型工具可见性和运行权限必须一致，不能只把工具从 UI 隐藏却仍可调用。

## 10. 控制面板规格

沿用已认可的 demo 布局和物理任务视角。现有 demo 是合成数据原型；生产版将其组件连接到真实事件与观察服务，不沿用假数据冒充运行结果。

### 10.1 核心工作区

| 区域 | 必须展示/支持 |
| --- | --- |
| 任务与指令 | 当前任务、约束、追加指令、运行来源、配置版本；输入已接收与已生效分开 |
| Sensor 视图 | 可用相机/深度/其他流，源与时间戳、断流/过期状态；当前画面和 agent 实际所见画面可对照 |
| Agent 状态 | 实例、角色、调用者、独立会话、当前委派、等待对象；查看收到的任务包与消息 |
| Team / Role | 所选 team 版本、成员别名与实际实例、role 定义、有效工具清单、启动失败原因 |
| Tool 调用 | 规划/文件/感知/主动观察/执行等分类、provider、输入观察、输出标注、实际资源与运行状态 |
| Embodiment 状态 | 实际连接、执行器状态、当前 job、控制预算、暂停/停止确认；组件按设备能力展示 |
| 子目标与恢复链 | goal、各 attempt、改变内容、retry/replan 归属、原恢复目标是否完成 |
| Verification | 监控反馈与正式 verdict 分开；逐项检查、GT 来源、未知原因、对应证据 |
| 经验 | Evolver 何时启动、读取了什么证据、产出的 SKILL 版本、适用范围与后续检索使用 |
| 统一时间线 | 用户命令、agent 消息、执行、暂停、验证、retry、经验创建按因果关联查看 |

### 10.2 关键交互

用户可下达任务、补充约束、请求暂停/终止、查看历史证据和恢复过程。恢复执行的用户意图交给 Planner 处理后形成明确执行决定。设备未确认时显示“暂停请求中”或“状态未知”，不能只因 agent 文字说停止就显示停止。

历史回看为只读，并显著标记所看的 attempt 和时间；不会将回看进度当作当前设备状态。调试 GT 面板单独标明“agent 不可见”，不能通过截取混合 UI 给 agent 的方式泄漏隐藏状态。

通过消息面板可以回答：“Verifier 为何暂停？”“Planner 为何决定再试？”“Evolver 用的是哪次失败？”“这个新 agent 到底收到哪些背景？”界面不显示或猜测模型私有内部推理，只呈现显式决策说明、工具调用与证据。

v1 允许从配置加载不同 agent 图并显示动态创建实例；拖拽式工作流编辑器不是必需交付。高频视频直接走流/资产通道，UI 不等待模型回复刷新。

## 11. 用户定义的 Team / Role 与接入体验

本项目的 composable agent 是 **team 形式的角色组合**。用户定义职责、选择工具，将角色放入 team，即可通过 harness 委派和协作。新增角色不要求复制 agent builder、不要求改 Python 的固定角色枚举，也不要求编写新的 agent loop。

### 11.1 最小用户工作流

1. 使用内置 team，或复制一个 team.yaml。
2. 新建一个 ROLE.md，写职责和需要的工具。
3. 在 team.yaml 的 members 中加入该文件。
4. 在控制面板选择该 team，检查解析出的成员、工具和责任绑定后启动任务。是否启动任务由用户原有运行流程决定，不额外设置逐角色审批。

使用已经注册的工具时，这个过程只需要配置文件。用户引入尚未接入的模型/设备服务时，再添加一个 tool provider；“简单定义角色”不意味着框架会自动实现任意自然语言描述的工具。

本规格的示例也单独放在 [examples](../examples/README.md)，便于后续 loader 实现作为输入 fixture。正文已完整包含内容，示例文件不是额外必读资料，当前尚无可运行的 Team loader。

### 11.2 一个自定义 Role

文件：`roles/scene-analyst.md`。以下为拟实施格式的完整最小示例：

````markdown
---
role_id: scene-analyst
description: 用可用的感知工具确认目标身份和空间关系，为调用者提供有证据的场景分析。
tools:
  - perception.capture
  - perception.segment_objects
  - perception.estimate_depth
---

你是场景分析员。本次任务和背景由调用方的 InvocationBrief 提供。

根据请求读取指定画面，必要时采集新观察、分割候选对象，并在深度可用时估计空间关系。
返回候选实体、证据引用、不确定性和需要调用者补充的信息。
不要把检测结果当作 ground truth；不要自行重试物理任务或移动机器人。
````

该角色的能力来自声明的工具。若用户希望它能转头观察，在 tools 中加入 `observation.turn_view`，并在委派包中明确允许的观察动作和预算；不用改成一个新的 agent 实现。

每个角色都可以通过 `AgentReport.status=needs_context` 请求调用方补充信息，不要求为了正常交接而配置额外工具；显式的 team 通信工具是便捷操作入口。角色最终报告属于协议输出，不是对任意成员文件的读取权限。

输出默认采用内置 `AgentReport.v1`；需要更严格的领域输出时，增加 `output_schema: ./schemas/scene-assessment.json`。该 JSON Schema 属于 role pack 的文件资产，需要通过 loader 验证并传给 DSH 结构化输出适配。未指定模型时使用 team/deployment 的默认模型路由，不继承调用方实例临时配置。

### 11.3 一个 Team 定义

文件：`team.yaml`：

```yaml
schema_version: physical.team.v1
team_id: household-team
entrypoint: lead
members:
  lead: builtin:planner
  verifier: builtin:verifier
  evolver: builtin:evolver
  scene: ./roles/scene-analyst.md
bindings:
  decision_owner: lead
  final_verifier: verifier
  recovery_evolver: evolver
tool_bindings:
  perception.segment_objects: sam_local
```

`sam_local` 是 deployment 已注册的 provider 名称。它可以指向独立 Python 服务或用户的其他实现；模型 checkpoint、密钥和服务地址属于 deployment 配置，不放进公开 role prompt。

这个 team 使用默认协作规则：entrypoint 接收用户任务；decision_owner 可以委派已声明成员；执行前给 final_verifier 完整上下文；retry 时给 recovery_evolver 完整上下文；与当前作用域匹配的执行/验证/恢复事件送达对应活跃 assignment。加入 scene 只让它成为可委派成员，不会无条件启动它，也不会广播整个任务历史给它。

Planner 的一次拟议调用：

```yaml
operation: team.delegate
member: scene
assignment_key: inspect-cup-before-attempt-2
brief:
  objective: 区分左侧杯子与右侧杯子，返回用户指定杯子的候选绑定
  task_scope:
    task_id: task_42
    goal_id: goal_store
  expected_output: builtin:AgentReport.v1
  known_facts:
    - 用户目标是左侧蓝色杯子；尚未确定稳定实体 ID
  evidence_refs: [obs_120]
  tools_and_limits:
    allowed_effects: [read_observation]
    max_tool_calls: 4
```

调用返回 `assignment_id / agent_id / status: accepted`；接收者从新的上下文工作，返回结构化报告。调用方之后决定是否使用该实体绑定。AgentReport 的 completed 只表示分析任务完成，不代表机器人任务被验证成功。

### 11.4 必需字段、默认值与校验

| 定义 | 必需内容 | 默认与校验 |
| --- | --- | --- |
| RoleDefinition | frontmatter 的 role_id、description、tools；非空 Markdown 正文作为 instructions | schema_version 省略时为 physical.role.v1；model 使用 team 默认；输入为 InvocationBrief.v1，输出为 AgentReport.v1 |
| TeamDefinition | schema_version、team_id、entrypoint、members、bindings | 名称引用必须存在；成员可引用 builtin role 或相对角色文件 |
| Role 工具 | 已注册逻辑 tool IDs；可选 toolsets 在展开后固定成 IDs | 未知工具、缺失 schema、效果声明不完整时在启动前报错，不让角色“先启动再看看” |
| Responsibility bindings | decision_owner、final_verifier；启用恢复经验时 recovery_evolver | v1 每个任务有一个最终决策归属；每个目标绑定一个最终 verifier；职责对应工具能力必须存在 |
| AgentReport.v1 | status、summary、result、evidence_refs | status 为 completed / failed / needs_context / cancelled；result 是 JSON；证据列表可为空但不能伪造引用 |

Role/Team ID 使用 `[a-z][a-z0-9_-]{0,63}`。`tools` 为去重字符串列表；除说明的扩展命名空间外拒绝未知字段，避免拼写错误静默失效。相对文件路径以所属 role/team 文件目录解析。只有内置引用使用 `builtin:` 前缀。

角色共享的是只读定义，实例有独立会话和工作区。运行开始时记录 team、role、工具版本的解析快照；用户修改文件只影响后续新运行，当前实例不被悄悄替换。热更新不属于 v1。

### 11.5 高级组合与动态创建

v1 支持两种组合：显式委派与事件订阅。可选 subscriptions 指定事件类型、目标成员、作用域过滤和交付方式。事件只投递给匹配任务/assignment 的已激活实例；若触发新实例，必须有调用方预先提交的完整 InvocationBrief，不能以一条裸事件替代足够背景。

成员别名不是运行实例地址。`team.send` 面向具体 assignment_id；如果一个成员有多个活跃实例，不允许含糊地发送到“某个 verifier”。新工作通过 `team.delegate` 创建新 assignment；同一 assignment 的后续消息才进入该实例自身上下文。

一个用户可以换掉 planner role、增加 scene analyst、增加专门的 object-state verifier，或者关闭 evolver 进行消融。绑定责任按能力校验，不按 role 名字校验。无 evolver 时明确标记 recovery learning disabled；final_verifier 和预算验证门槛仍是默认物理任务运行配置的必需职责。多个专业 verifier 可以向指定 final_verifier 提供报告，最终 verdict 归属保持明确。

默认单机实现中任意已声明成员可被授权委派，不限于一棵固定的 nav/manip 树；消息权限和路由由 team run 管理，父子关系只保留调用/交接责任。用户自定义新 role 不自动拥有机器人控制权，获得某个分析工具也不自动获得 retry/replan 权限。

### 11.6 Loader、Role Factory 与用户体验验收

实现顺序固定为：读取配置 → 解析 role/tool/schema 引用 → 展开默认值和 toolsets → 检查责任/模型/设备兼容性 → 生成不可变 TeamRunSnapshot → 通过 DSH 创建目标作用域中的新实例 → 注入该角色的 instructions 和调用方任务包。

Role Factory 应建立目标 role 的 DSH composition，而不是沿用父 agent 默认 composition。共享底层模型客户端、连接池或只读 provider 不意味着共享角色 prompt、会话或可变工具状态。Tool call 永远携带 assignment scope；有状态感知服务自行隔离或串行管理其 session。

控制面板提供 team 选择、成员列表、role 定义预览、有效工具列表和缺失依赖诊断。简单文件式 authoring 是第一版重点，不要求先建设拖拽编辑器或扩展商城。

新增角色的验收样例：在默认 team 中加入上面的 scene-analyst，使用已经注册的感知工具完成一次独立委派；替换其分割 provider 后 role 文件不变；检查调用包、模型实际工具列表、返回证据及上层接收结果。整个流程不得修改核心角色枚举或专用 agent builder。

## 12. 技术落地与旧项目迁移

### 12.1 EDH 主体结构与 DSH 吸收

本项目采用独立 EDH monorepo。`apps/server` 与 `apps/console` 装配产品；
`packages/` 按 agents、teams、models、tools、communication、planning、files、
tasks、execution、perception、observation、verification、memory、storage、contracts 平铺。
Python provider 在 `python/physical_harness/src/physical_harness/`。
[模块表](architecture/modules.md) 是实际路径与责任来源。

DSH 提供待吸收的底层实现；不自行重写循环。源代码迁移前需验证依赖与运行边界，
逐项保留许可证和来源映射。本轮只固定来源并建立接口，尚未复制 DSH runtime。
旧 spec 中的 physical 插件/fork 挂载描述是职责参考，由此处的 EDH 主体结构替代。
共享 schema 仍采用单一来源；TypeScript 类型生成，Python 运行边界验证在 Step 01 实现。

### 12.2 旧 EAF 的迁移映射

| 旧实现 | 保留 | 改造 |
| --- | --- | --- |
| `execute_subtask` | 指令与成功条件分离、闭环责任 | 固定 manip/nav 改能力绑定；阻塞文本结果改 job + 事件 + 结构化报告 |
| 上下文 project | 相关区域和对象摘要 | 升级 InvocationBrief，实例 ID、时间和证据明确；不依赖全局场景图 |
| top_agent 的基础工具 | write_todos、文件读写、委派等规划能力 | DSH 工具桥接与持久 PlanDocument；assignment 私有工作文件 |
| perception / sam_backend / depth | 采图、分割、标注和定位接口 | 独立可插入 provider，观察身份和标定明确，不隐式共享空间记忆 |
| rotate_camera | 主动获取新视角的能力 | 按真实 head/base 资源调度；返回实际姿态与新观察，不能假定仅相机运动 |
| ExecutionReport | 执行摘要和最终观察引用 | 自报成功降为诊断，正式验证单独建模 |
| verification / rollout_monitor | 独立检查、运行中观察和中止路径 | DSH verifier agent；预算事件强制触发；事实与恢复建议分开 |
| verification bundle | 每次尝试的独立证据资料 | 加版本、因果链、设备确认、实际 agent 可见输入 |
| policy contracts / registry | 类型规格、延迟加载、远程推理接入 | 增强单位/坐标/关节/频率兼容检查 |
| lessons | 原失败资料作为输入 | retry 驱动 evolver，成功恢复写 SKILL，保留范围 |
| 全局 TRACE/SCENE_GRAPH/计数 | 相应职责 | task/attempt 作用域，移除跨任务隐式共享 |
| BEHAVIOR backend | 已有真实环境接入路径 | 提取通用边界，R1Pro 绑定留在适配配置 |
| Deep Agents builders | 角色经验和有用 prompt 内容 | 运行时迁移至 DSH，不携带第二套 agent loop |

旧代码没有实际完整的 RoboCasa/RoboTwin 接入，mock 不能计为这些环境已经支持。旧 nav/manip 内部 agent 自行局部重试的行为不迁入默认设计。

## 13. 里程碑与验收

本节定义产品能力及完成条件；具体施工顺序以第 17 节为准，可先在测试后端实现后期能力，再做真实环境验收。

里程碑按能力依赖排列，不预估缺少算力/人员信息时的工期。M0–M3 构成第一版主线，其中硬件接口的测试后端验证随 M0/M2 完成；M4 是更多真实配置的扩展性验证；真机实测安排在 M5。

| 阶段 | 交付 | 完成证据 |
| --- | --- | --- |
| M0：Team、Tool 与独立上下文 | Team/Role loader、Tool Catalog、DSH role factory、InvocationBrief、消息路由、测试执行/感知/设备后端 | 用户加 role 只改配置；目标角色工具不继承父级；新实例不含父历史；重复消息不重复动作 |
| M1：上层工具与仿真闭环 | 持久计划/工作文件、感知和主动观察工具、BEHAVIOR worker、policy 接口、GT Verifier | 可观察、规划、转动视角并执行；预算耗尽必验证；实际资源/控制步可追踪 |
| M2：异步监督与恢复 | 非阻塞执行、监控反馈、暂停确认、上层 retry/replan、恢复链、硬件接口故障场景 | 执行期间上层可收到反馈；只有上层启动新 attempt；完成一次失败恢复；测试后端断连/重连/停止状态可验证 |
| M3：经验与控制面板 | retry 触发 Evolver、SKILL 版本检索、生产数据 UI | 成功恢复产生可追溯经验；下一次全新 agent 显式检索使用；面板能解释过程 |
| M4：扩展性验证 | 第二种实际环境/embodiment 配置、DiMOS 最小接口实验、硬件契约验证 | 新 adapter 不修改通用核心；明确哪些是真实运行、哪些是测试/回放验证 |
| M5：真机实测 | 具体硬件、兼容 policy、真机证据 provider | 真实任务、停止/断连状态、验证未知处理；独立于仿真结果报告 |

第一版即使真机不可用，也必须在测试设备后端验证不同能力声明、异步数据、暂停/停止确认、断连与重连状态。DiMOS 最小互操作在依赖可用时推进；未完成时明确列为未验证适配，不标注“已支持”。

### 13.1 必须通过的契约与集成检查

| 场景 | 必须观察到的结果 |
| --- | --- |
| 独立上下文 | 给 Planner 放入未交接的信息，被调用 agent 的真实模型输入中没有该信息；显式交接后才出现 |
| 新任务调用旧模板 | 新 session，不残留上一 task 的对象、消息和工作记忆 |
| 背景不足 | 被调用 agent 发送 context.request，不从其他会话隐式读取 |
| 能力不兼容 | 在执行前拒绝并说明缺少相机/控制模式/检查映射，不能假成功 |
| 正常预算耗尽 | 停止推进策略、形成边界、正式验证请求可追踪；模型未调用验证工具也不能跳过流程 |
| 过期 monitor 反馈 | 旧 attempt 或旧观察的结论不能完成当前 attempt |
| Verifier 暂停 | 请求与设备确认分开；只有 Planner 恢复或发起新 attempt |
| 重复投递/重连 | 同一 execution 幂等；不确定状态先查询，不重复物理命令 |
| GT 隔离 | Agent 输入只含授权检查结果；调试隐藏状态未进入上下文 |
| Retry 与经验 | 上层明确 retry 才启动恢复总结；普通成功不触发；失败的恢复链不产生成功 SKILL |
| 重规划的前置子目标 | 前置步骤成功不关闭原恢复目标，原目标正式验证后才结案 |
| SKILL 泛化边界 | 记录来源配置；目标不兼容时不自动套用；不修改权威成功条件 |
| Agent 替换组合 | 新模板和新的事件订阅通过配置接入，协议无需增加固定角色枚举 |
| 用户定义 Team | 只添加 role 文件及 team 成员配置，完整完成一次委派，不修改专用 builder |
| Role 工具隔离 | 父角色有 execution.start，感知角色没有；检查其模型 schema 和实际调用权限均不包含该能力 |
| 工作文件与计划 | 两个 assignment 的同名 progress.md 不互相覆盖；跨回合计划仍可恢复；写 todo 不伪造 goal passed |
| Perception provider 替换 | 保持 role 和输入 observation 不变，换 provider 后依然返回合法实例/mask/overlay 引用 |
| 主动观察资源 | 同一工具在云台与底盘配置解析到不同资源；与策略冲突时不会并发执行；返回实际姿态 |
| Tool 依赖缺失 | 未安装 SAM/GPU 依赖仍可启动 CPU 默认测试配置；选用缺失 provider 时报告明确诊断 |

### 13.2 研究评测

至少报告任务成功率、首次尝试成功率、retry/replan 次数、恢复成功率、控制步、墙上时间、模型调用与成本、监控延迟/画面滞后、暂停确认延迟和验证覆盖。未知结果单列，不能删除后只报成功样本。

评测分开：无经验、原始 episode 资料、提炼后的 SKILL；另比较只有结束验证与异步 monitor + 结束验证。所有条件使用相同任务集合、policy、预算与 GT 可见性，避免将额外 oracle 信息当作经验收益。

跨配置迁移先对齐同一个语义任务、对象角色、必要能力与成功条件，再比较无源经验和有源 SKILL 的结果。源技能库固定后评测目标配置；目标侧修订产生的收益另列为适配收益。每次运行记录技能版本、任务顺序和随机种子，在线积累与冻结库评测分开。

硬件适配便利性用新增文件/改动范围、通用核心是否变化、契约测试结果衡量；不能用一个 mock 的低接入成本证明所有真机都容易适配。

## 14. 实施配置与后续演进

以下事项不影响已经确认的架构，实施前按实际资源绑定：

- 第一套可用的 subgoal policy checkpoint、所需 GPU、输入规格和支持的 instruction 粒度；不合适时训练/微调作为独立工作包。
- 第二个真实环境或 embodiment 的接入顺序；BEHAVIOR、RoboCasa、RoboTwin 均在扩展目标内。
- Verifier 采样间隔、模型预算、任务执行预算和端到端延迟目标；需要实测，当前不写未经验证的性能数字。
- 真机型号、相机配置、DiMOS 或直接 SDK/ROS2 后端，以及实际可用的暂停/停止与证据能力。
- 项目正式名称、发布许可证、依赖锁定和模型/数据授权说明。保留 DSH 与各上游组件要求的许可证及归属文件；不把模型权重授权等同于代码授权。

v1 文件系统 SKILL 和单机 Host/Worker 是实现默认，不限制后续远程存储或多机部署。需要改变职责、上下文隔离或验证门槛的设计应单独记录决策，不在 adapter 中悄悄绕过。

## 15. 参考依据与当前完成状态

### 15.1 参考依据

| 来源 | 借鉴与边界 |
| --- | --- |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/tree/d347e703908d0406b7a7ef80e3a0e594d86b2215) | 固定版本调研 agent 内核、session、工具、插件、fresh spawn 与 UI 接入；已完成模块地图和关键路径阅读，未全仓逐行审计 |
| [DSH agent 接口](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/core/agent/README.md) | scoped 创建、followup/steer/inject、生命周期；消息在模型步骤边界进入，不代表硬实时处理 |
| [DSH subagent control](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/subagent/tool-subagent-control/README.md) | 默认直接父子消息；任意组合的任务事件路由由本项目扩展 |
| [DSH skill filesystem](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/skill/skill-filesystem/README.md) | SKILL.md 发现与按需加载；具身兼容筛选及证据版本管理另行实现 |
| [DSH agent presets](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/preset/agent-presets/README.md) | 角色 composition 的复用基础；默认 child 可加入父 composition，必须显式验证目标 role 装配 |
| [DSH todo 工具](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/todo/tool-todo/README.md) | 单会话清单与 UI 投影；不能直接当作跨回合共享 task plan |
| [DSH fs 工具](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/fs/tool-fs/README.md) | read/read_image/write/edit；通过 workspace provider 管理每个 assignment 的可见范围 |
| [DSH fs-search](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/fs/tool-fs-search/README.md) | glob/grep；其子进程搜索路径需要与 workspace 范围对齐 |
| [DSH MCP client](https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/packages/mcp/mcp-client/README.md) | 外部工具桥接；本项目补充 effect/resource/结果契约，不默认取得资源或 prompt 支持 |
| 旧 Embodied-Agent-Framework（来源记录见 provenance） | 版本 714e00ca83999da2df7221dcf205968adde5b441；复用执行/验证闭环、上下文投影、policy 规格和运行证据设计 |
| [DiMOS](https://github.com/dimensionalOS/dimos) | 模块、类型流、Blueprint、硬件 protocol、MCP；作为可选硬件后端候选，未安装或进行互操作验证 |
| [ASPIRE](https://research.nvidia.com/labs/gear/aspire/) | 参考有证据的恢复经验和迁移边界；本项目 SKILL 面向上层决策与验证，未复现论文结果 |

详细调研及被后续决定覆盖的历史讨论见 [源码调研与架构讨论](provenance/README.md)。旧目录的原始想法是参考材料；其中“只考虑仿真”“时间预算用完直接重规划”等内容已被本规格的新决定覆盖。

### 15.2 当前状态

当前交付为 EDH 工程骨架、接口、结构 schema、配置样例、规格与 SVG 图。之前控制面板 demo 已获方向认可；当前 console 仅有界面数据契约。DSH 运行时吸收、loader、工具执行、验证、记忆、真实流、仿真及真机均未实现。实际状态与检查见 implementation/progress.md。

## 16. 实施工作包、源码入口与首个端到端场景

本节是供接手 agent 直接开始工作的开发交接。无需读取历史对话才能知道先做什么；引用旧源码用于核对和迁移，不把源码里的旧 prompt 或安装 workaround 当作新的用户需求。

### 16.1 优先阅读的源码入口

所有 DSH 相对路径以固定 commit 的 checkout 为根；远端源码基址为 `https://github.com/deepseek-ai/deepseek-harness/blob/d347e703908d0406b7a7ef80e3a0e594d86b2215/`。可直接把下表路径附到此基址，恢复临时 checkout 丢失时的来源。

| 用途 | DSH 路径 | 实施时核对 |
| --- | --- | --- |
| 创建独立 role 实例 | `packages/core/agent/src/index.ts`、`packages/core/agent/src/runtime-types.ts` | ctx.agents.create、setup scope、send/followup/steer 的真实签名 |
| 默认循环与工具推进 | `packages/core/agent-loop/src/index.ts`、`packages/core/agent-loop/src/tool-calls.ts` | 使用原循环；物理 resource ownership 不靠单 agent 独占工具实现 |
| 角色装配 | `packages/preset/agent-presets/src/index.ts`、`packages/preset/agent-presets/src/mount.ts`、`packages/preset/agent-presets/src/session.ts` | 目标 preset/scope 显式绑定；默认 child 继承 composition 的路径不可照搬 |
| 工具 schema 与调用 | `packages/core/tools/src/index.ts`、`packages/core/tools/src/types.ts` | 原生 registry、执行信号、结构化/多模态结果如何接入 |
| 后台创建与通信 | `packages/subagent/tool-subagent/src/index.ts`、`packages/subagent/tool-subagent-control/src/index.ts` | 默认父子通信限制；本项目 team router 的注册边界 |
| 计划与文件 | `packages/todo/tool-todo/src/index.ts`、`packages/fs/tool-fs/src/index.ts`、`packages/fs/tool-fs-search/src/index.ts` | plan 持久性、私有 workspace 与搜索路径限制 |
| 外部工具 | `packages/mcp/mcp-client/src/index.ts` | 返回格式、图像引用、取消与重连语义 |
| 状态与 UI | `packages/core/session/src/types.ts`、`packages/api/gateway/README.md`、`packages/client/ui-tool/src/client/index.ts` | durable 事件与 UI projection，不靠解析模型文案还原状态 |
| 经验 | `packages/skill/skill-filesystem/README.md`、`packages/skill/tool-skill/src/index.ts` | 原生发现/加载和新的 metadata 索引边界 |

旧 EAF 相对路径以另行取得的旧项目 checkout 为根：

| 用途 | 旧源码入口 | 保留与修正 |
| --- | --- | --- |
| 上层工具与 prompt | `src/eaf/agent/agents/top_agent.py`、`src/eaf/agent/agents/prompts/top.py` | 规划、工作文件、感知、场景记忆；移除固定机器人常数 |
| 感知管线 | `src/eaf/agent/tools/perception.py` | capture、detect/segment、overlay、depth/localize；去掉全局共享副作用 |
| SAM / 深度 provider | `src/eaf/agent/interfaces/sam_backend.py`、`src/eaf/agent/interfaces/da3_depth.py`、`src/eaf/agent/interfaces/lingbot_depth.py` | 可替换接口和延迟加载；重新验证实际依赖/API |
| 主动观察与实际运动 | `src/eaf/agent/interfaces/http_backend.py`、`src/eaf/sim/behavior/motion.py` | rotate 的真实 base/head 资源与 achieved pose |
| 子任务与验证 | `src/eaf/agent/orchestration/subtask_executor.py`、`src/eaf/agent/orchestration/verification.py`、`src/eaf/agent/orchestration/verify_bundle.py` | 明确输入、独立验证与证据；升级异步与身份关联 |
| 运行中监控 | `src/eaf/agent/runtime/rollout_monitor.py` | 监控不等于硬停止确认；旧 abort 标记不能直接用作设备状态 |
| Policy 与环境 | `src/eaf/contracts.py`、`src/eaf/sim/schemas.py`、`src/eaf/sim/behavior/session.py` | 调用形状与预算；环境类型不得泄漏到通用工具协议 |

### 16.2 首批工作包

W01–W07 用于按职责归类；W07 的 UI、真实环境接入和交付验收在第 17 节进一步拆分，避免成为一个难以验证的大任务。

下面的目标文件和测试名称是待创建的交付位置，不是声称当前已有这些文件。按依赖顺序推进，完成一个可验证切片再扩大范围。

| ID | 工作内容 | 目标输出 | 完成条件 |
| --- | --- | --- | --- |
| W01 | 固定协议来源 | `packages/contracts/`：RoleDefinition、TeamDefinition、ToolDefinition、InvocationBrief、MessageEnvelope、AgentReport、PlanDocument、Observation/ToolResult 的 schema 与跨语言 JSON fixtures | 合法示例可解析，缺字段/未知 role/tool/无效引用被拒绝；版本一致 |
| W02 | Team/Role loader 与 Catalog | `packages/teams/`、`packages/tools/`：定义读取、引用解析、预检、TeamRunSnapshot | 本文最小 role/team 示例可解析；添加成员不改枚举；工具绑定缺失有确定错误 |
| W03 | DSH role factory 与通信 | 创建 fresh assignment、role scope、非阻塞 delegate、send/reply、context.request、订阅 | A/B 角色 prompt/tools/workspace 不泄漏；调用包和实际模型输入可关联 |
| W04 | 上层核心工具 | `packages/planning/`、`packages/files/`；PlanDocument 与 DSH todo/UI 映射；受限文件搜索 | 计划跨异步 turn 保留；版本冲突被拒绝；独立 progress.md；显式引用可交接 |
| W05 | 完整工具执行切片 | CPU 测试 capture/segmentation、主动观察、执行 job、检查工具；统一 ToolResult 与资源锁 | 用户 scene role 调用感知并回传；头部/底盘冲突可测；不依赖 SAM/GPU |
| W06 | Verifier 与恢复链 | 正式验证门槛、monitor、pause ack、Planner retry、Evolver 启动/成功写入 | 预算耗尽必验；只有 owner 发起 attempt；原恢复目标通过才产出经验 |
| W07 | UI 与真实 adapter | team/role/tool 面板、真实 BEHAVIOR/provider 迁移、可选 SAM 服务 | 用真实运行事件替换 demo 数据；明确依赖与未验证能力 |

W01–W06 的 schema、fixture 和集成测试可以在无 GPU 的机器上实现。GPU、simulator、checkpoint 缺失时停留在对应真实适配工作包的依赖边界，不将 CPU 测试声称为策略效果验证。

### 16.3 首个可复现的 CPU 验收场景

场景使用明确标记的 test backends 和脚本化模型响应，验证 framework 行为，不验证模型智能：

1. 加载 household-team，包含用户文件定义的 scene-analyst；其工具只有所选感知工具和框架最小通信能力。
2. Planner 收到“把左侧蓝色杯子放入柜子”，写入 PlanDocument，并在自己的 workspace 写 progress。
3. Planner 通过 InvocationBrief 委派 scene；新会话只收到明确包与自己的 role prompt。Scene 调用 capture/segment，返回目标候选和来源帧；不能调用 execution.start。
4. Planner 绑定目标并提交 attempt_1。测试策略按约定控制步运行；verifier 异步收到观察。到预算边界，系统必须请求正式验证，测试 GT 返回 inside=false。
5. Planner 明确发起 retry，登记 recovery_1，并把失败记录与变化发给全新 evolver。第二次尝试返回 inside=true，final_verifier 正式提交匹配原目标的 passed。
6. Evolver 使用显式证据生成一条来源标记为 test fixture 的 SKILL；上层收到经验引用。另建新 task 的全新 Planner，只有显式调用 skills.search/load 后才可见该条目。

预期事件骨架如下，ID 仅为 fixture 名称；感知和 monitor 事件可以穿插：

```text
team.resolved → assignment.created(planner)
plan.updated → assignment.created(scene) → tool.completed(segment) → agent.report(scene)
assignment.created(verifier) → execution.started(attempt_1)
execution.budget_exhausted → verification.requested → verification.completed(failed)
retry.requested(planner) → retry.started(recovery_1) → assignment.created(evolver)
execution.started(attempt_2) → execution.ended → verification.requested
verification.completed(passed, original_goal) → recovery.resolved(success)
experience.created(test_fixture) → agent.report(evolver)
```

测试固定输入和响应，并检查真实发送到 DSH 模型适配器的消息内容/工具 schema。不能只断言 helper 返回了 fresh=true。媒体 fixture 必须含可读取的实际图片或明确测试占位类型，不能将坏图片标成真实 sensor。测试技能默认存于独立 fixture 库，不能污染真实经验。

### 16.4 构建、测试与交接报告

当前实际命令见 [development/setup.md](development/setup.md)：`pnpm install --frozen-lockfile`
和 `pnpm check`。骨架检查不是框架运行验收。后续功能测试命令在对应步骤实现后记录，
不沿用 DSH 原仓库测试路径冒充本仓库已通过。Python 协议可无 GPU 导入，真实 provider
依赖在后续步骤隔离安装。每次报告列出实际改动、检查结果、未执行项与下一步骤。

### 16.5 变更记录

- v1.0（2026-09-06）：确定 DSH 物理闭环、独立上下文、异步 verifier、retry evolver、适配接口与控制面板。
- v1.1（2026-09-07）：将 composability 明确为用户定义 Team/Role；补齐规划/工作文件/感知/主动观察等 Tool Catalog；加入角色作用域隔离要求、源码入口、CPU 开工切片和交接验收。覆盖 v1.0 将“可组合”主要表达为默认角色配置的不足。

- v1.2（2026-09-07）：补充 Step 00–16 的实施顺序、逐步动作与验收门槛、CPU/真实仿真/后续真机的阶段边界，以及进度记录与中断接手规则。图示继续使用 SVG。

## 17. Step-by-step Implementation Plan

逐步计划已迁至 [implementation/plan.md](implementation/plan.md)，该文件是唯一维护副本。
本仓库新增 Skeleton Bootstrap 阶段；接口与目录完成不等于 Step 00–16 的功能验收完成。

- v1.3（2026-09-07）：确定 EDH 为仓库主体，按概念平铺模块；选择性吸收 DSH，独立记录来源；新增骨架交付，实施计划迁至单独文件。
