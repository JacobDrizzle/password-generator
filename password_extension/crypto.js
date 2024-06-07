// crypto.js
export async function getKeyFromPassword(password, salt) {
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function encryptData(data, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encodedData
    );
    return {
        iv: arrayBufferToBase64(iv),
        data: arrayBufferToBase64(encryptedData),
    };
}

export async function decryptData(encryptedData, key) {
    const iv = base64ToArrayBuffer(encryptedData.iv);
    const data = base64ToArrayBuffer(encryptedData.data);
    const decryptedData = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
    );
    return new TextDecoder().decode(decryptedData);
}

export function arrayBufferToBase64(buffer) {
    const byteArray = new Uint8Array(buffer);
    let byteString = "";
    for (let i = 0; i < byteArray.byteLength; i++) {
        byteString += String.fromCharCode(byteArray[i]);
    }
    return btoa(byteString);
}

export function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const byteArray = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
    }
    return byteArray.buffer;
}