load(arguments[0]);
const document = JSON.parse(readFile(arguments[1]));
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
requireValue(Values.isJsonValue(document), 'Actual import manifest must be valid JSON data.');
requireValue(
  JSON.stringify(Values.snapshotJsonValue(document)) === JSON.stringify(document),
  'Snapshot must preserve actual manifest content.',
);
const realm = $262.createRealm();
const foreign = realm.evalScript(`JSON.parse(${JSON.stringify(JSON.stringify(document))})`);
requireValue(Values.isJsonValue(foreign), 'Actual cross-realm manifest must be accepted.');
requireValue(Values.isJsonValue(document.files), 'Actual manifest arrays must be accepted.');
requireValue(Values.isJsonValue(foreign.files), 'Actual cross-realm arrays must be accepted.');
class ManifestEnvelope {
  constructor(value) {
    this.value = value;
  }
}
class ManifestArray extends Array {}
requireValue(
  !Values.isJsonValue(new ManifestEnvelope(document)),
  'Reject custom object prototypes.',
);
requireValue(
  !Values.isJsonValue(new ManifestArray(...document.files)),
  'Reject custom array prototypes.',
);
requireValue(!Values.isJsonValue(new Date()), 'Reject native non-JSON objects.');
print(
  JSON.stringify({
    engine: 'JavaScriptCore',
    intrinsicObject: Function.prototype.toString.call(Object),
    intrinsicArray: Function.prototype.toString.call(Array),
    actualManifestFiles: document.files.length,
    sameRealm: true,
    crossRealm: true,
    customObjectRejected: true,
    customArrayRejected: true,
  }),
);
