# Step-by-step Implementation Plan

本文件是实际施工顺序；章节引用均指 [project-spec.md](../project-spec.md)。第 16 节提供源码入口与工作包归类，本节将其拆成可以连续执行、单独验收和交接的步骤。**Step 00–16 均未完成验收。Skeleton Bootstrap 已建立部分接口和样例，不能据此勾选功能步骤；以 [progress.md](progress.md) 为准。** 默认依次完成 Step 00–14 交付 v1；Step 15–16 是后续扩展。不以修改文档或勾选清单代替运行证据。

### 17.1 执行顺序与阶段门槛

| 顺序 | 要完成的能力 | 前置步骤 | 工作包 / 里程碑归属 | 通过后可以做什么 |
| --- | --- | --- | --- | --- |
| 00 | 固定来源、选择性吸收 DSH 并验证运行入口 | 无 | 开工准备 | 开始实现契约与插件 |
| 01 | 共享协议与状态转换契约 | 00 | W01 | 两种语言使用同一协议 |
| 02 | Team / Role loader 与 Tool Catalog | 01 | W02 | 从配置生成可检查的运行快照 |
| 03 | 独立角色会话与 DSH 工具装配 | 02 | W03 | 运行用户定义的角色 |
| 04 | 显式通信、事件持久化与证据引用 | 03 | W03 | 角色异步合作且可恢复交接 |
| 05 | 上层规划、工作文件与默认 role pack | 04 | W04 | Planner 有持续工作的核心工具 |
| 06 | CPU 执行 worker、资源调度与硬件契约 | 05 | W05 / M0 | 非阻塞执行并确认实际设备状态 |
| 07 | 感知、主动观察与 provider 替换 | 06 | W05 | 用户角色通过统一工具完成观察任务 |
| 08 | 异步 Verifier 与强制正式验证 | 07 | W06 | 预算结束后有权威判定 |
| 09 | Planner retry / replan 与恢复关联 | 08 | W06 | 原失败目标可被跟踪至恢复或放弃 |
| 10 | Evolver 与 SKILL 存储、检索 | 09 | W06 | 成功恢复形成可追溯经验 |
| 11 | 整体 CPU 闭环验收 | 10 | W01–W06 集成门槛 | 固定协议，再接生产 UI 与仿真 |
| 12 | 控制面板接入运行事件和传感器 | 11 | W07 / M3 的 UI 部分 | 用户能操作并解释完整任务过程 |
| 13 | BEHAVIOR 真正接入与策略兼容验证 | 12 | W07 / M1–M2 的真实环境部分 | 跑通第一套真实仿真配置 |
| 14 | v1 综合验收、复现与交付 | 13 | M0–M3 总验收 | 发布候选版本具备完整证据 |
| 15 | 第二种环境 / embodiment 与迁移评测 | 14 | M4 | 验证可替换性与经验迁移主张 |
| 16 | 具体真机接入与实测 | 14 + 硬件绑定 | M5 | 获得独立的真机运行证据 |

第 13 节的 M0–M5 是产品能力分组，不要求按其编号逐个编写代码。例如先在 CPU 测试后端实现 M2/M3 的恢复与经验机制，再在 Step 13 验证真实环境行为。Step 11 通过仅表示框架协议闭环成立；Step 14 通过才表示第一版仿真主线完成。

每步遵循同一流程：确认前置验收证据 → 实现最小可运行切片 → 跑该步正常与关键失败场景 → 更新进度记录 → 进入下一步。已通过的检查不无理由反复重跑；改动影响到的契约和集成路径必须重新验证。默认按表顺序施工；以后拆分协作时，也不得绕过依赖门槛。

### Step 00 — 建立开发基线并验证 DSH 接入方式

**前置：** 第 0 节的源码资产可定位；开发目录遵循第 0.2 节，接续已有 checkout 时保留其改动。

1. 核对 DSH commit、仓库说明、依赖声明和工作区状态；记录旧 EAF 与控制面板原型的位置。创建开发进度记录 `docs/implementation/progress.md`，记录 spec v1.3 与各步骤状态。
2. 在 EDH checkout 中按来源映射选择性吸收 DSH 必要实现，核对依赖与模块导入；完成 pnpm 类型检查及 DSH 集成切片测试。不复制整个上游仓库，不安装仿真或 GPU 依赖。
3. 做一个最小接入实验：用 DSH 原生循环和脚本化模型适配器启动 agent，注册一个返回固定结构结果的工具，并从宿主注入一条后续消息。
4. 核对 scoped factory、目标 role 的 prompt/tools 装配和后台实例唤醒路径。将实际使用的 API、取消行为、事件钩子及必要补丁位置写入 `docs/implementation/dsh-integration.md`。

**交付：** 可运行的 DSH 接入实验、基线检查记录、明确的 EDH 内部装配位置。

**验收门槛：** 实际工具调用和后续消息由 DSH 原循环推进；没有新增另一套模型循环。若接入 API 与调研基线不同，先修正桥接设计及记录，再进入 Step 01。

### Step 01 — 固定跨语言契约与状态转换

**前置：** Step 00 通过。主要位置：`packages/contracts/`、`tests/contracts/`。

1. 按第 4–9、11 节建立单一版本来源的 schema：Team/Role/Tool 定义、InvocationBrief、MessageEnvelope、AgentReport、PlanDocument、观察/媒体引用、SubgoalRequest、执行状态、VerificationResult、恢复关联和 skill metadata。
2. 明确必填字段、ID 作用域、单位/坐标/时间语义、错误结构和版本兼容策略。将哪些字段可缺省、哪些引用必须在装配时解析写成规则。
3. 将执行、验证和恢复状态转换写成可检查的转换表；将“执行结束≠目标通过”“预算耗尽不能续额”“未知不能转成成功”落实为拒绝条件。
4. 用同一组 JSON fixtures 验证 TypeScript 与 Python 的接受/拒绝结果；Team 中未知工具等跨引用错误归 Step 02 的语义校验，不混入纯 JSON 结构校验。

**交付：** schema、跨语言有效/无效 fixtures、状态转换表及协议版本说明。

**验收门槛：** 两端接受相同合法数据，拒绝缺少关键身份、错误单位声明和不支持版本的数据；旧 attempt 的 verdict 不能推进新 attempt。协议缺项在此补齐后再建立各模块，避免双端各自发明字段。

### Step 02 — 实现 Team / Role loader 与 Tool Catalog

**前置：** Step 01 通过。主要位置：`packages/teams/`、`packages/tools/`，导入本规格的 `examples/` 作为 fixtures。

1. 读取 team.yaml、ROLE.md 和 tool pack；解析相对引用、内置 role、toolset 和 provider 绑定，并展开默认值。
2. 校验成员别名、职责绑定、工具 schema、模型/媒体能力与设备兼容性；错误要指明具体文件、字段和缺失能力。
3. 生成不可变 TeamRunSnapshot，包含有效 prompt 引用、工具清单、provider 绑定和配置版本；加载过程本身不启动物理动作。
4. 提供配置预检入口并在完成后记录实际命令。使用已有 provider 时，用户只需增加一个 scene role 文件和 team 成员即可接入。

**交付：** loader、Catalog、运行快照、可复用配置示例和预检诊断。

**验收门槛：** 本文最小 Team 可解析；新增角色不改核心枚举；未注册 provider、缺少责任绑定或不兼容模型在启动前失败。CPU 默认配置不导入 SAM/torch/仿真包。

### Step 03 — 将角色映射到真正独立的 DSH 会话

**前置：** Step 02 通过。主要位置：`packages/teams/`、`packages/agents/` 及 DSH 桥接插件。

1. 从 TeamRunSnapshot 创建角色实例；每次新委派生成新的 assignment/session，显式装配该 role 的 prompt、工具和资源视图。
2. 注入经校验的 InvocationBrief，分配 assignment 私有 workspace；同一委派的后续消息进入自己的会话，新委派不能自动复用旧上下文。
3. 接入结构化 AgentReport、取消与失败返回；实例是否存活、当前处理什么任务以状态事件暴露。
4. 使用可记录模型实际输入的测试适配器，检查父级 composition、历史消息和专属工具是否意外进入子角色。

**交付：** Role Factory、独立会话生命周期、真实模型输入检查用例。

**验收门槛：** Planner 持有的秘密测试标记不出现在 scene 的输入中；通过 InvocationBrief 显式交接后才出现。Scene 的模型工具清单和服务端授权均不允许 execution.start；不能只在 prompt 中写“不要执行”。

### Step 04 — 建立显式通信、事件记录和证据访问

**前置：** Step 03 通过。主要位置：`packages/communication/`、`packages/tasks/` 与证据存储接口。

1. 实现非阻塞委派、点对点 send/reply、context.request/response 和受作用域限制的订阅。调用方收到接纳结果后可以继续自己的任务。
2. 在宿主校验真实发送者与权限，分配消息 ID、关联 ID、因果 ID 和 task 内序号；正式请求/结果先持久化，再投递并去重。
3. 建立证据引用解析与授权读取，分离原始媒体、关键事件和 agent 实际收到的选帧/消息记录。读取引用不意味着可以读整个 task 的所有私有资料。
4. 实现断开后补投递、处理结果查询、超时/取消通知和 context 不足时的请求路径；原始高频帧合并不能丢掉预算或停止事件。

**交付：** 通用 router、可恢复事件记录、证据访问接口、跨角色调用轨迹。

**验收门槛：** 非父子成员可按授权通信；重复消息不重复创建 assignment；缺少背景时显式请求补充；agent 不能冒充服务或读取未授权 GT。一次任务能追溯“发了什么、被接纳了什么、模型实际看到了什么”。

### Step 05 — 补齐上层核心工具与默认角色定义

**前置：** Step 04 通过。主要位置：`packages/planning/`、`packages/files/`、`packages/agents/`。

1. 实现持久 PlanDocument、版本检查和 DSH todo/UI 投影；计划状态与权威 goal/verification 状态分离。
2. 接入 assignment 范围内的文件读写、编辑、列举和搜索，保留明确引用的资料交接；验证底层文件搜索没有绕过 workspace 作用域。
3. 将工具以各自明确 schema 注册到 Catalog，覆盖计划、工作文件、通信和证据读取；不退化成一个只能传任意字符串的工具入口。
4. 从旧 top_agent 提取有用的规划和上下文组织方式，编写默认 Planner/Verifier/Evolver ROLE.md。移除固定 nav/manip 树、机器人常数和下层自行 retry；暂未实现的工具绑定明确禁用，不能静默伪装为可用。

**交付：** 上层核心工具、默认 role pack、可跨异步回合恢复的任务工作状态。

**验收门槛：** 两个 assignment 的 progress.md 互不覆盖；异步消息唤醒后计划仍在；写 todo 不会使任务自动 passed。用户自定义 scene role 可以完成“读任务包→请求背景→用工具→返回报告”。

### Step 06 — 实现 CPU 执行 worker 与设备资源契约

**前置：** Step 05 通过。主要位置：`packages/execution/`、`python/physical_harness/src/physical_harness/execution/`、`embodiments/`、`backends/`。

1. 建立 TypeScript Host 与 Python CPU worker 的版本化请求/事件桥接；先实现测试 policy 和测试设备后端，后端声明能力、控制步含义和暂停/停止支持情况。
2. 实现 submit/query/pause/resume/stop 对应的 job 生命周期，接纳时返回 execution_id，实际推进放在后台；控制步与墙上时间预算分别计量。
3. 依据实际 actuator/base/head 等资源实施排他和冲突处理；只有已确认停止/释放后才能交接资源，不能以模型文字当作设备确认。
4. 实现幂等接纳、重复请求查询、worker 断连与重连后的状态核对；预算耗尽停止继续发动作并发出持久事件。
5. 用两种测试能力配置验证通用接口，例如独立云台与“转视角需要转底盘”的配置；同时覆盖无法原地 resume 的后端。

**交付：** 非阻塞执行服务、跨语言集成、资源调度、硬件接口测试后端。

**验收门槛：** 同一幂等键只启动一个 job；pause_requested 与 paused 可区分；断连不自动重发运动；策略动作段不被计为新 attempt；预算耗尽后不会继续控制。此阶段暂停与控制均为测试后端行为，不表示真机已验证。

### Step 07 — 打通感知与主动观察工具

**前置：** Step 06 通过。主要位置：`packages/perception/`、`packages/observation/`、对应 Python provider。

1. 实现 capture、分割、深度/定位的统一输入输出，用实际可读取的图片和已知标定 fixtures 验证 observation、mask、overlay、实体绑定与坐标信息。
2. 接入两个 CPU 测试分割 provider，保持逻辑工具 ID 和 role 不变，仅切换 provider 绑定；标明它们是测试实现。
3. 实现主动观察意图到设备动作的映射，返回 achieved pose 与新的 observation；“转头看左侧”在不同设备上解析到不同实际资源。
4. 将感知结果和标注媒体接入证据存储与 AgentReport；感知工具不隐式更新跨任务的全局 scene memory。保留原生 TS、Python RPC、MCP 的接入边界；重依赖真实 provider 在 Step 13 按选择接入。

**交付：** 可插入感知工具、主动观察路径、scene role 的完整工具任务。

**验收门槛：** 换分割 provider 不改 role；标定或坐标信息缺失时返回明确不可用结果；主动观察与执行策略抢占同一底盘时不能同时控制。Scene 返回的候选对象能定位到输入帧和对应输出证据。

### Step 08 — 实现异步 Verifier 与不可绕过的验证门槛

**前置：** Step 07 通过。主要位置：`packages/verification/`、`packages/tasks/`、Python verification provider。

1. 将 Verifier 作为独立 DSH agent 按任务包启动；观察流按最新帧/短片段合并，每实例最多一个在途模型请求，关键执行事件另行保留。
2. 实现 monitor.feedback 和有权限的暂停请求，记录所用观察的 attempt、时间与序号；不授予 retry/replan 权限。
3. 在预算耗尽及其他终止边界建立持久 verification.requested；即使 Planner 没有主动调用验证也必须进入该流程。未完成的旧 monitor 输出不能替代边界后的正式检查。
4. 接入限定 GT 检查工具与正式 AgentReport；校验最终责任实例、条件版本、检查覆盖和证据一致性。无新证据、检查不支持或设备状态不明时保留 unknown。

**交付：** 并行监控、暂停反馈、强制验证触发器、正式 verdict 门槛。

**验收门槛：** 测试策略仍运行时可以收到监控反馈；预算耗尽一定出现正式验证请求；旧帧/旧 attempt/非责任实例的 passed 被拒绝；GT 明确 false 时 agent 不能把它提交成 passed。终止时仍在推理的监控请求不会吞掉正式验证事件。

### Step 09 — 实现 Planner 决策与恢复链

**前置：** Step 08 通过。主要位置：`packages/tasks/`、`packages/communication/` 和 Planner 工具。

1. 接入 resume/retry/replan/finish/abandon 决策，校验调用者是当前 decision_owner；新的尝试由上层明确创建 attempt，而非执行 provider 自动发起。
2. 接纳显式 retry 后生成 recovery_id，固定原失败目标、原条件版本、失败证据与本次变化；持久化 retry.started，供 Step 10 启动 Evolver。
3. 允许重规划插入前置子目标，保持其与原恢复目标的关联；只有原目标正式通过才成功关闭恢复链，放弃或失败保留对应记录。
4. 覆盖迟到反馈、重复 retry 请求、取消与上一 attempt 尚未确认停止的情况；阻止同一资源上重叠启动新尝试。

**交付：** 上层决策工具、恢复关联器、可追踪的多 attempt 任务记录。

**验收门槛：** “杯子未进柜→先打开柜门→再放杯子”的场景中，柜门打开不会被认作原目标恢复成功；Verifier、Evolver 或 policy 发起 retry 均被拒绝；重复接纳事件不重复创建恢复链。

### Step 10 — 实现 Evolver 与可检索 SKILL

**前置：** Step 09 通过。主要位置：`packages/memory/`、`packages/agents/` 与 DSH skill 桥接。

1. 在 retry.started 后创建全新 Evolver assignment，发送原失败资料、恢复目标、本次变化和授权证据引用；同一恢复链的后续 retry 通过显式消息更新。
2. 使 Evolver 在执行期间记录恢复过程；原目标经正式 verifier 判定 passed 前，只写工作记录，不发布成功经验。
3. 原恢复目标通过后生成第 8 节的 SKILL bundle，包含上层决策启发、验证提示、能力要求、适用边界、来源和版本；校验完成后原子保存并发 experience.created。
4. 接入 skills.search/load，先按任务语义与能力/条件兼容性筛选，再按需加载；测试库与真实库隔离。新 agent 必须显式检索，不将整个经验库自动塞入每个上下文。

**交付：** Evolver 生命周期、SKILL 写入/版本/检索、来源可追踪的经验返回。

**验收门槛：** 普通一次成功不启动 Evolver；失败恢复不写成功 SKILL；“打开柜门”前置成功不提前发布；重复成功事件不产生重复版本。新 task 的 Planner/Verifier 可明确检索到兼容经验，不兼容技能不会被当作通用规则，技能也不能修改权威判据。

### Step 11 — 完成 CPU 端到端验收并固定可复现入口

**前置：** Step 00–10 的验收均有记录。主要位置：`packages/tasks/tests/`、`tests/contracts/`、`examples/`。

1. 将第 16.3 节场景实现为一个可重复执行的集成入口：自定义 scene role、感知工具、attempt_1 失败、Planner retry、独立 Evolver、attempt_2 正式成功、新任务检索 SKILL。
2. 检查真实进入 DSH 模型适配器的任务包、工具 schema 与消息，不只测试外围 helper；保存媒体引用、事件链和最终报告。
3. 增加独立的关键故障变体：重复消息、过期 verdict、worker 断连、暂停未确认、缺少上下文、GT 隔离和原恢复目标未完成。
4. 给出实际依赖安装和运行命令、预期输出与失败定位方法；执行类型检查及受影响测试，在进度中记录基线问题和新增问题。

**交付：** 无 GPU 的完整 framework 演示、自动化集成验收、可读取的运行证据。

**验收门槛：** 新 checkout 按说明能重现同一状态与事件结果；无需模型密钥、SAM 或 simulator 即可跑 CPU fixture；所有结果显式标记 test fixture。此门槛通过后，才把这套协议作为 UI 和真实环境的稳定接入目标。

### Step 12 — 将控制面板接到框架运行数据

**前置：** Step 11 通过。主要位置：`apps/console/`、gateway 投影接口。

1. 复用已认可 demo 的布局方向，将各区域映射到第 10 节的数据字段；UI 状态从运行事件和查询接口产生，不解析模型自然语言猜状态。
2. 接入 Team 预检/选择、用户任务与约束、暂停/终止意图、Planner 决策反馈；请求已接收、已处理与设备已执行分别显示。
3. 接入 sensor/标注媒体、agent 独立会话、实际工具清单、embodiment 状态、验证和恢复链；提供当前画面与 agent 实际所见证据的对照。
4. 接入历史回放、断流/过期提示、SKILL 来源与检索记录；测试数据模式、回放模式和真实运行模式明确区分。

**交付：** 基于运行事件工作的控制面板，先连接 CPU fixture/回放，Step 13 再接真实传感器。

**验收门槛：** 用户可从界面完成并追溯 Step 11 场景；新增 scene 成员会自动显示；设备没确认暂停时界面不会显示已暂停；回放不发送物理命令；调试 GT 不进入 agent 可见图像或消息。浏览器刷新和事件重连后状态可恢复。

### Step 13 — 接入 BEHAVIOR 与第一套真实策略配置

**前置：** Step 12 通过；BEHAVIOR 运行资源、robot 配置和可用 policy 已绑定。主要位置：Python environments/policies/embodiments/perception/verification 与部署示例。

1. 核对旧 EAF 的实际环境、策略、perception 和 motion 入口，列出可迁移函数与依赖；在隔离的可选环境中安装实际锁定的 simulator/checkpoint/provider。
2. 先验证 adapter：reset/观察/能力声明、对象角色绑定、坐标与单位、控制频率、GT success contract 映射；不先用整个 agent 系统掩盖底层接口错误。
3. 单独验证 policy 能消费所绑定配置的 subgoal instruction，运行一次受预算约束的执行，并核对真实步数、终止观察、暂停/停止确认。若 checkpoint 不具备该能力，明确阻塞真实策略验收，不用脚本策略冒充；训练/微调另行立项。
4. 迁移感知和主动观察工具，确认 rotate 对实际 base/head 的影响；若选择 SAM 类服务，再锁定其代码与模型版本，运行同一工具契约测试，未选择则保持可选。
5. 依次跑真实仿真中的单 subgoal、多个 subgoal、预算验证、异步暂停和失败恢复；接入真实图像与状态到面板，验证 Planner/Verifier/Evolver 全链路。

**交付：** 一套真实可运行的 BEHAVIOR + embodiment + policy 配置、启动说明、真实运行证据与已知限制。

**验收门槛：** 实际模拟器产生观察和控制结果；不是 CPU 录制数据；GT 只通过限定检查暴露；预算耗尽必验；资源冲突和停止边界正确。若为覆盖恢复路径而有意注入故障，标注故障注入，不能计作自然任务成功率样本。

### Step 14 — v1 综合验收与可交接交付

**前置：** Step 13 通过，Step 00–12 的受影响检查仍通过。

1. 逐条映射第 13.1 节要求到实际测试或运行证据，包括 CPU 硬件接口断连/重连/停止确认；记录测试后端与真实仿真各自覆盖的范围。
2. 在固定任务集合、policy、预算与 GT 可见性下做初始评测，至少提供无经验与检索 SKILL 的对照；保存原始运行结果和第 13.2 节指标，不以少量成功 demo 宣称泛化。
3. 整理默认 team、自定义 role、provider 替换、CPU 演示和 BEHAVIOR 部署的完整示例；将所有拟定命令替换为已验证的实际命令。
4. 在新 checkout 按 quickstart 复现 CPU 路径，并在具备资源的环境复现仿真路径；补充配置版本、依赖/模型来源、许可证归属、已知限制和下一个未完成步骤。
5. 形成 v1 验收报告和发布候选清单。正式名称、对外发布及其他尚未绑定事项按第 14 节处理；完成本步骤不自动代表已发布远程仓库或软件包。

**交付：** 可供其他 agent 和开发者接手的 v1 代码、示例、测试、运行证据、评测基线和文档。

**验收门槛：** M0–M3 每项都有可定位证据；CPU fixture、真实仿真和未实测真机严格区分。若真实仿真未跑通，只能交付阶段成果，不能将 v1 标为完成。

### Step 15 — 验证第二种环境与经验迁移

**前置：** Step 14 通过；按实际资源选择 RoboCasa、RoboTwin 或第二种 embodiment，记录选择，不预设全部同时接入。

1. 复用同一 adapter conformance suite 实现观察、实体、动作、能力和目标检查映射；绑定兼容 policy，跑实际任务。
2. 保持通用核心和基础协议不变，记录新增配置/provider 文件及不得不修改的核心位置；若必须修改协议，说明缺失抽象并回归第一种配置，不能藏在特殊分支里。
3. 选择语义、对象角色和成功条件可对齐的同一任务，冻结源 SKILL 库，对照目标配置有/无源经验；目标侧新修订的技能单列。
4. 按第 13 节推进 DiMOS 的最小接口互操作；条件不具备时记录未验证项，与第二环境的完成状态分开报告。

**交付与验收：** 第二种实际配置、核心改动统计、适配契约报告和跨配置评测。只完成 schema/mock 不能标注 RoboCasa/RoboTwin 已支持；迁移无收益或失败也保留结果。

### Step 16 — 接入具体真机并独立验收

**前置：** Step 14 通过；具体硬件、控制后端、兼容 policy、运行条件和实测范围已明确。可以在 Step 15 之后开展，也可在其配置不具备时独立推进。

1. 选择 DiMOS、设备 SDK 或 ROS2 等实际后端，映射到既有能力和 job 契约；先验证真实 sensor、标定、设备状态与只读观察。
2. 按已确定的实测范围验证受限动作、资源占用、设备本地停止、断连行为和重连状态查询，再运行 subgoal policy。
3. 用真实视觉/设备信号替换仿真 GT provider，保留 unknown；无法证实完成时不沿用仿真中的确定判定。
4. 接入同一 Team、消息协议、控制面板和恢复记录，提交独立真机报告；涉及硬件特性的限制通过能力声明和 adapter 表达。

**交付与验收：** 可复现真机配置、动作与停止确认记录、真实任务和验证证据。接好相机或在 mock 中通过设备接口都不能计作完整真机任务验收。

### 17.2 每一步的进度与交接记录

开发仓库中的 `docs/implementation/progress.md` 是实施状态入口；本规格是要求来源，不因计划条目存在就标为完成。状态只取 `not_started / in_progress / blocked / done`。目前全部为 `not_started`，第一个执行目标是 Step 00。

每个步骤采用下面的记录格式；这里是待实施模板，没有已通过的测试：

```yaml
step: '00'
status: not_started
spec_version: '1.3'
base_commit: null
implementation_commit: null
changed_files: []
commands_run: []
acceptance_evidence: []
known_limitations: []
blocked_on: []
next_step: '01'
```

`done` 必须附命令及结果、输出/日志路径和验收门槛对应证据；`blocked` 要写明确缺失项、影响哪一门槛、解除方式，以及已经完成的独立部分。例如缺少 policy checkpoint 阻塞 Step 13 的真实执行，不应回退或否认已通过的 CPU 闭环，也不能用 CPU 结果填补真实运行证据。已选配置或环境信息不足时，在进入依赖它的步骤前向用户澄清。

步骤中断后，下一位 agent 先核对进度记录与实际代码/测试是否一致，再继续第一个未完成子项；不从头重建仓库，不因为报告里写过“完成”就跳过缺失证据。新增设计决策写入 `docs/implementation/decisions/`，注明原因、受影响的 spec 条款和验证方式。
