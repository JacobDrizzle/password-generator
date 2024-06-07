// storage.js
export function savePasswordToStorage(passwords, callback) {
    chrome.storage.local.set({ passwords: passwords }, callback);
}

export function getPasswordFromStorage(callback) {
    chrome.storage.local.get({ passwords: [] }, callback);
}

export function clearStorage(callback) {
    chrome.storage.local.clear(callback);
}
