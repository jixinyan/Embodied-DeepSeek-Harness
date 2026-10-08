import { isNativeDeploymentEntry } from '../../apps/server/src/native-deployment.mjs';
import { runNativeWorkspace } from '../../apps/server/src/native-workspace.mjs';

export {
  default,
  createNativeWorkspaceFactory,
  readNativeWorkspaceConfiguration,
  runNativeWorkspace,
} from '../../apps/server/src/native-workspace.mjs';

if (isNativeDeploymentEntry(import.meta.url)) await runNativeWorkspace();
