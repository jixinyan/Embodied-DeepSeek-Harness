# Desktop launcher

The Electron application selects a local launch configuration, starts one owned EDH
HTTP service and opens the existing console in an isolated window. Closing that
console keeps the service running. Stop service and application quit wait for the
server's task/environment cleanup and child process exit. Startup, shutdown and
unexpected-exit errors remain visible; the launcher never force-terminates a device
worker or assumes that a process exit proves a robot stopped.

## Build and open

Prepare the checkout and build the native application:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm check:structure
pnpm build:desktop
```

The result is under `dist/desktop/EDH-<platform>-<architecture>/`. On macOS, open
`EDH.app` from Finder. The executable includes Electron and its Node runtime; the
selected EDH checkout and its installed dependencies remain external. Moving that
checkout requires updating the launch configuration. `pnpm desktop` starts the
same launcher during development. Published installers, code signing and bundled
simulation/policy installations are separate release work.

## Configuration

Create a local JSON file with the following shape. Every path resolves relative
to this JSON file; absolute paths are also supported. Port `0` requests an available
loopback port. This example assumes the file lives in the checkout's `.local/`:

```json
{
  "version": 1,
  "repository": "..",
  "deployment": "../examples/deployments/robotwin-live.mjs",
  "dataDirectory": "./desktop-robotwin",
  "environmentFile": "./robotwin.env",
  "port": 0
}
```

Create `.local/robotwin.env` with the existing native deployment and model
configuration paths:

```dotenv
EDH_ROBOTWIN_CONFIG=/absolute/path/robotwin-deployment.json
EDH_MODEL_CONFIG=/absolute/path/model.yaml
```

The native deployment JSON specifies the actual worker, scene, task catalog,
checkpoint and policy endpoint. Model configuration specifies the existing model
endpoint and adapter. Their credentials remain inside the service process. See
[native deployment configuration](../../examples/deployments/README.md) for
RoboTwin, RoboCasa, BEHAVIOR and RoboDojo factory paths and required variables.
An existing closed workspace can be selected as `dataDirectory`; its immutable
history is readable after startup.

`environmentFile` is optional. Node loads its values only inside the owned service
process. Existing environment values take precedence. Secrets are not copied into
the saved launcher selection, configuration metadata or renderer state. Deployment
code and its logs are trusted local content and must not print credentials.

The deployment module must default-export a factory accepting `DeploymentServices`
and returning a `ServerDeployment`, synchronously or asynchronously. It composes
the same registered model adapters, tools and provider factories documented in the
[deployment guide](../../docs/implementation/deployments.md). It must not start a
server itself. The launcher supplies root, data directory and port to `startServer`;
the default application-owned image store remains available to the factory. Existing
native example entry points default-export this factory and start a standalone
server only when executed directly. Importing them does not allocate a model,
policy gateway or simulator. Provider configuration supplies the selected Team,
role root, task catalog and worker settings.
Their `storageRetention` factory binds complete native record ownership and
original-image retention to this owned workspace. The Console provides explicit
history archiving, retention inspection and deletion admission through those bindings.

Choose configuration validates paths without importing deployment code. Start service
executes the selected module in a fresh process using the checkout's tsx loader and
runtime aliases. Service readiness is published only after `startServer` returns its
listening loopback URL. The console still owns compatible environment, embodiment,
execution mode, checkpoint, policy, model and task selections. No environment or model inference starts merely
because the launcher window opens.

Open the application, choose the JSON file and select **Start service**. Select
**Open console**, choose the compatible configuration and check its component
values. **New session** allocates that configuration's environment and discovers
its native tasks. Task submission starts the selected model workflow. Keep
**Start service**, **New session** and task submission as separate operator actions.
Select **Stop service** to close the Console and drain the service, or quit the
application to perform the same owned-service cleanup. A `stopped` state follows
the server's successful close acknowledgement and successful child process exit.

The launcher remembers only the last selected configuration path in Electron's user
data directory. It never restarts a service or resumes a task automatically. Console
web content has no launcher IPC or Node access. Only the local launcher main frame
can select files or control the owned process. External navigation and new windows
are denied. Service output retains its latest 65,536 characters for inspection.
`EDH_LAUNCHER_DATA_DIR` can select an absolute application-data directory, including
for an isolated installation; it does not change the deployment's task data directory.

## Acceptance

`pnpm test:launcher` exercises actual configuration files and child processes:
path resolution, strict fields, environment-file privacy, missing configuration,
actual EDH module import/export rejection, repeated launch and startup cancellation.
No model, scripted adapter or physical backend executes. Successful deployment
startup/task execution still requires a configured provider deployment and live
acceptance. A clean cancellation before allocation does not certify device shutdown.

`pnpm test:desktop` launches actual Electron windows and reads DOM/IPC state without
screenshots or substituted dialogs. It checks remembered selection, actual failed
service imports, repeated starts, Node/context isolation and denied new windows.
Set `EDH_DESKTOP_EXECUTABLE` to a packaged application's executable to exercise the
same checks against that build. This test does not automate the native file chooser.

Desktop UI and packaging checks are recorded in [progress](../../docs/implementation/progress.md).

The packaged macOS application also passed a positive native configuration check:
the actual saved RoboTwin deployment, configured Qwen model and Pi0.5 profile
started its owned service and opened the unified Console. Every selected component
matched the installed profile; native storage maintenance was available. Two
cycles exercised **Stop service** and application quit. Both released the journal
writer, exited the service child and closed its loopback listener. The renderers
retained sandbox/context isolation with no Node access or JavaScript errors.
This configuration/lifecycle check performed no model inference or environment
allocation; physical task acceptance is recorded independently.
