# Desktop launcher

The Electron application selects a local launch configuration, starts one owned EDH
HTTP service and opens the existing console in an isolated window. Closing that
console keeps the service running. Stop service and application quit wait for the
server's task/environment cleanup and child process exit. Startup, shutdown and
unexpected-exit errors remain visible; the launcher never force-terminates a device
worker or assumes that a process exit proves a robot stopped.

## Build and open

Prepare the checkout with `pnpm install`, then build the native application:

```sh
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
  "deployment": "./deployment.ts",
  "dataDirectory": "../.runs/workspace",
  "environmentFile": "./model.env",
  "port": 0
}
```

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
standalone example scripts start their own servers and do not implement this export.

Choose configuration validates paths without importing deployment code. Start service
executes the selected module in a fresh process using the checkout's tsx loader and
runtime aliases. Service readiness is published only after `startServer` returns its
listening loopback URL. The console still owns compatible environment, embodiment,
checkpoint, model and task selections. No environment or model inference starts merely
because the launcher window opens.

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
