const element = (id) => document.getElementById(id);
let state;
let busy = false;
let requestError = '';
function render() {
  if (!state) return;
  element('configuration').textContent = state.configFile || 'No launch configuration selected.';
  element('status').textContent = state.status;
  element('address').textContent = state.url || '';
  element('error').textContent = requestError || state.error || '';
  element('log').textContent = state.log || 'No service output.';
  element('select').disabled = busy || state.owned;
  element('start').disabled = busy || state.owned || !state.configFile;
  element('stop').disabled = busy || !state.owned || state.status === 'stopping';
  element('open').disabled = busy || state.status !== 'running';
  element('operation').textContent =
    state.status === 'stopping' ? 'Waiting for service cleanup and process exit…' : '';
}
window.launcher.subscribe((next) => {
  state = next;
  render();
});
for (const name of ['select', 'start', 'stop', 'open'])
  element(name).addEventListener('click', async () => {
    busy = true;
    requestError = '';
    render();
    try {
      await window.launcher[name]();
      state = await window.launcher.state();
    } catch (error) {
      requestError = error.message;
    } finally {
      busy = false;
      render();
    }
  });
window.launcher.state().then(
  (next) => {
    state = next;
    render();
  },
  (error) => {
    element('error').textContent = error.message;
  },
);
