(function (root, factory) {
  const storage = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = storage;
  root.CoevolutionStorage = storage;
}(typeof window === 'undefined' ? globalThis : window, function (root) {
  'use strict';

  const DATABASE = 'history-of-becoming';
  const STORE = 'experiments';
  const DATABASE_VERSION = 1;

  function openDatabase() {
    if (!root.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable. Experiments can be explored in this tab but cannot be saved on this browser.'));
    return new Promise((resolve, reject) => {
      const request = root.indexedDB.open(DATABASE, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Could not open experiment storage: ${request.error?.message || 'unknown IndexedDB error'}`));
      request.onblocked = () => reject(new Error('Experiment storage is blocked by another open tab. Close older Reading Room tabs and reload.'));
    });
  }

  function requestResult(request, operation) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`${operation} failed: ${request.error?.message || 'unknown IndexedDB error'}`));
    });
  }

  async function list() {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE, 'readonly');
      const records = await requestResult(transaction.objectStore(STORE).getAll(), 'Loading experiments');
      return records.sort((left, right) => left.name.localeCompare(right.name));
    } finally {
      database.close();
    }
  }

  async function save(experiment) {
    const validation = root.CoevolutionModel.validateExperimentImport({
      schemaVersion: root.CoevolutionModel.SCHEMA_VERSION,
      experiment
    });
    if (!validation.valid) throw new TypeError(`Experiment is not valid and was not saved: ${validation.errors.join(' ')}`);
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(JSON.parse(JSON.stringify(experiment)));
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(new Error(`Saving experiment failed: ${transaction.error?.message || 'unknown IndexedDB error'}`));
        transaction.onabort = () => reject(new Error(`Saving experiment was aborted: ${transaction.error?.message || 'unknown IndexedDB error'}`));
      });
    } finally {
      database.close();
    }
    return experiment;
  }

  async function remove(id) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(id);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(new Error(`Deleting experiment failed: ${transaction.error?.message || 'unknown IndexedDB error'}`));
        transaction.onabort = () => reject(new Error(`Deleting experiment was aborted: ${transaction.error?.message || 'unknown IndexedDB error'}`));
      });
    } finally {
      database.close();
    }
  }

  return { list, save, remove };
}));
