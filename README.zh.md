# Embodied DeepSeek Harness（EDH）

以用户可定义的 Agent Team 为组织方式，连接上层决策、感知工具、执行策略、
异步验证与长期经验的具身智能框架。EDH 是项目主体，后续选择性吸收 DSH 的
底层实现，不复制整个上游产品，也不另写一套 Agent loop。

**当前为工程骨架。** 已有公共接口、配置样例、跨语言协议来源与文档；Agent
运行、Team loader、仿真、真机、SAM 和控制面板均未实现。目录存在不代表已支持。

![框架总览](docs/architecture/assets/framework-overview.svg)

- [完整规格](docs/project-spec.md)
- [逐步实施计划](docs/implementation/plan.md)
- [当前进度与下一个工作项](docs/implementation/progress.md)
- [目录导航与模块职责](docs/architecture/modules.md)
- [扩展样例](examples/README.md)
- [DSH 来源与集成边界](docs/provenance/README.md)

日常开发：应用入口在 `apps/`；框架模块在 `packages/`；物理服务在 `python/`；
用户定义样例在 `examples/`；测试在 `tests/`；接手说明在 `docs/`。
例如改角色定义进入 `packages/agents/roles/`，改正式验证门槛进入
`packages/verification/`，改 GT provider 进入 Python 的 `verification/`。

安装并检查骨架：

```sh
pnpm install --frozen-lockfile
pnpm check
```

需要 Node.js 22.19+、pnpm 11.19.0 与 Python 3.11+。检查仅覆盖结构、类型、
样例和导入，不代表具身闭环通过。所有后续功能状态以进度文档为准。
