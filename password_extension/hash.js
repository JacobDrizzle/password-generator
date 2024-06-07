// hash.js
export async function hashPassword(password) {
    const encoded = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    return arrayBufferToBase64(hashBuffer);
}

function arrayBufferToBase64(buffer) {
    const byteArray = new Uint8Array(buffer);
    let byteString = "";
    for (let i = 0; i < byteArray.byteLength; i++) {
        byteString += String.fromCharCode(byteArray[i]);
    }
    return btoa(byteString);
}
