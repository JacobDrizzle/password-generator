document.addEventListener('DOMContentLoaded', function() {
    const masterPasswordDiv = document.getElementById('master-password-setup');
    const masterPasswordInput = document.getElementById('master-password');
    const setMasterPasswordBtn = document.getElementById('set-master-password-btn');
    const appDiv = document.getElementById('app');
    const verifyMasterPasswordInput = document.getElementById('verify-master-password');
    const verifyBtn = document.getElementById('verify-btn');
    const generateBtn = document.getElementById('generate-btn');
    const saveBtn = document.getElementById('save-btn');
    const saveToFileBtn = document.getElementById('save-to-file-btn');
    const passwordField = document.getElementById('generated-password');
    const tagInput = document.getElementById('tag-input');
    const messageDiv = document.getElementById('message');
    const verifyMessageDiv = document.getElementById('verify-message');
    const retrievedPasswordsDiv = document.getElementById('retrieved-passwords');
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    const passwordTitle = document.getElementById("password-title");
    
    tooltipElements.forEach(function(elem) {
        // Create tooltip container
        const tooltipContainer = document.createElement('div');
        tooltipContainer.classList.add('tooltip');

        // Create tooltip text element
        const tooltipText = document.createElement('span');
        tooltipText.classList.add('tooltiptext');
        tooltipText.textContent = elem.getAttribute('data-tooltip');

        // Wrap the button in the tooltip container
        elem.parentNode.insertBefore(tooltipContainer, elem);
        tooltipContainer.appendChild(elem);
        tooltipContainer.appendChild(tooltipText);
    });

    chrome.storage.local.get(['masterPasswordHash'], function(result) {
      if (result.masterPasswordHash) {
        masterPasswordDiv.style.display = 'none';
        appDiv.style.display = 'block';
      } else {
        masterPasswordDiv.style.display = 'block';
        appDiv.style.display = 'none';
      }
    });
  
    setMasterPasswordBtn.addEventListener('click', async function() {
      const masterPassword = masterPasswordInput.value;
      if (masterPassword) {
        try {
          const masterPasswordHash = await hashPassword(masterPassword);
          chrome.storage.local.set({ masterPasswordHash }, function() {
            masterPasswordDiv.style.display = 'none';
            appDiv.style.display = 'block';
          });
        } catch (error) {
          messageDiv.textContent = `Error setting master password: ${error.message}`;
        }
      } else {
        messageDiv.textContent = 'Please enter a master password!';
      }
    });
  
    verifyBtn.addEventListener('click', async function() {
      const enteredPassword = verifyMasterPasswordInput.value;
      chrome.storage.local.get(['masterPasswordHash'], async function(result) {
        try {
          const masterPasswordHash = result.masterPasswordHash;
          const enteredPasswordHash = await hashPassword(enteredPassword);
          if (enteredPasswordHash === masterPasswordHash) {
            verifyMessageDiv.textContent = '';
            verifyMasterPasswordInput.style.display = 'none';
            verifyBtn.style.display = 'none';
            passwordField.style.display = 'block';
            generateBtn.style.display = 'block';
            tagInput.style.display = 'block';
            saveBtn.style.display = 'block';
            saveToFileBtn.style.display = 'block';
            passwordTitle.style.display ='block';
            retrievePasswords();
          } else {
            verifyMessageDiv.textContent = 'Incorrect master password!';
          }
        } catch (error) {
          verifyMessageDiv.textContent = `Error verifying password: ${error.message}`;
        }
      });
    });
  
    generateBtn.addEventListener('click', generatePassword);
    saveBtn.addEventListener('click', savePassword);
    saveToFileBtn.addEventListener('click', savePasswordsToFile);
  
    function generatePassword() {
      const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
      let password = "";
      for (let i = 0, n = charset.length; i < 18; ++i) {
        password += charset.charAt(Math.floor(Math.random() * n));
      }
      passwordField.value = password;
      messageDiv.textContent = '';
    }
  
    async function savePassword() {
      const password = passwordField.value;
      const masterPassword = verifyMasterPasswordInput.value;
      const tag = tagInput.value;
  
      if (!masterPassword) {
        messageDiv.textContent = 'Please enter the master password!';
        return;
      }
  
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const key = await getKeyFromPassword(masterPassword, salt);
  
      if (password && tag) {
        try {
          const encryptedPassword = await encryptData(password, key);
          chrome.storage.local.get({ passwords: [] }, function(result) {
            const passwords = result.passwords;
            passwords.push({ tag, salt: arrayBufferToBase64(salt), encryptedPassword });
            chrome.storage.local.set({ passwords: passwords }, function() {
              messageDiv.textContent = 'Password saved successfully!';
            });
          });
        } catch (error) {
          messageDiv.textContent = `Error saving password: ${error.message}`;
        }
      } else {
        messageDiv.textContent = 'Generate a password and provide a tag!';
      }
    }
  
    async function encryptData(data, key) {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encodedData = new TextEncoder().encode(data);
      const encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encodedData
      );
      return { iv: arrayBufferToBase64(iv), data: arrayBufferToBase64(encryptedData) };
    }
  
    async function decryptData(encryptedData, key) {
      const iv = base64ToArrayBuffer(encryptedData.iv);
      const data = base64ToArrayBuffer(encryptedData.data);
      const decryptedData = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
      );
      return new TextDecoder().decode(decryptedData);
    }
  
    async function getKeyFromPassword(password, salt) {
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
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    }
  
    async function hashPassword(password) {
      const encoded = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      return arrayBufferToBase64(hashBuffer);
    }
  
    function arrayBufferToBase64(buffer) {
      const byteArray = new Uint8Array(buffer);
      let byteString = '';
      for (let i = 0; i < byteArray.byteLength; i++) {
        byteString += String.fromCharCode(byteArray[i]);
      }
      return btoa(byteString);
    }
  
    function base64ToArrayBuffer(base64) {
      const binaryString = atob(base64);
      const byteArray = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
      }
      return byteArray.buffer;
    }
  
    async function retrievePasswords() {
      const masterPassword = verifyMasterPasswordInput.value;
      if (!masterPassword) {
        messageDiv.textContent = 'Please enter the master password!';
        return;
      }
  
      chrome.storage.local.get({ passwords: [] }, async function(result) {
        try {
          const passwords = result.passwords;
          const decryptedPasswords = [];
          for (const { tag, salt, encryptedPassword } of passwords) {
            const key = await getKeyFromPassword(masterPassword, base64ToArrayBuffer(salt));
            const decryptedPassword = await decryptData(encryptedPassword, key);
            decryptedPasswords.push({ tag, password: decryptedPassword });
          }
          displayRetrievedPasswords(decryptedPasswords);
        } catch (error) {
          messageDiv.textContent = `Error retrieving passwords: ${error.message}`;
        }
      });
    }

    async function savePasswordsToFile() {
        const saveMethod = prompt('Save passwords as plain text or encrypted? (Enter "plain" or "encrypted")');
        if (saveMethod === 'plain' || saveMethod === 'encrypted') {
          chrome.storage.local.get({ passwords: [] }, async function(result) {
            const passwords = result.passwords;
            const passwordList = [];
      
            for (const { tag, encryptedPassword, salt } of passwords) {
              let password = '';
              if (saveMethod === 'encrypted') {
                password = JSON.stringify(encryptedPassword);
              } else {
                const masterPassword = verifyMasterPasswordInput.value;
                const key = await getKeyFromPassword(masterPassword, base64ToArrayBuffer(salt));
                password = await decryptData(encryptedPassword, key);
              }
              passwordList.push({ tag, password });
            }
      
            const blob = new Blob([JSON.stringify(passwordList, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'passwords.txt';
            a.click();
            URL.revokeObjectURL(url);
          });
        } else {
          messageDiv.textContent = 'Invalid option. Please enter "plain" or "encrypted".';
        }
      }
  
    function displayRetrievedPasswords(passwords) {
      passwords.forEach(({ tag, password }) => {
        const passwordItem = document.createElement('div');
        passwordItem.classList.add('password-item');
  
        const tagDiv = document.createElement('div');
        tagDiv.classList.add('tag');
        tagDiv.textContent = tag;
  
        const passwordContainer = document.createElement('div');
        passwordContainer.classList.add('password-container');
  
        const passwordDiv = document.createElement('input');
        passwordDiv.classList.add('password');
        passwordDiv.type = 'password';
        passwordDiv.value = password;
        passwordDiv.readOnly = true;
  
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Show';
        toggleButton.classList.add('toggle-btn');
        toggleButton.addEventListener('click', () => {
          if (passwordDiv.type === 'password') {
            passwordDiv.type = 'text';
            toggleButton.textContent = 'Hide';
          } else {
            passwordDiv.type = 'password';
            toggleButton.textContent = 'Show';
          }
        });
  
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy';
        copyButton.classList.add('copy-btn');
        copyButton.addEventListener('click', () => {
          // Temporarily set the input type to text to copy the value
          const originalType = passwordDiv.type;
          passwordDiv.type = 'text';
          passwordDiv.select();
          document.execCommand('copy');
          passwordDiv.type = originalType; // Revert back to original type
  
          copyButton.textContent = 'Copied';
          setTimeout(() => {
            copyButton.textContent = 'Copy';
          }, 2000);
        });
  
        passwordContainer.appendChild(passwordDiv);
        passwordContainer.appendChild(toggleButton);
        passwordContainer.appendChild(copyButton);
  
        passwordItem.appendChild(tagDiv);
        passwordItem.appendChild(passwordContainer);
  
        passwordItem.addEventListener('mouseover', () => {
          passwordContainer.style.display = 'flex';
        });
  
        passwordItem.addEventListener('mouseout', () => {
          passwordContainer.style.display = 'none';
        });
  
        retrievedPasswordsDiv.appendChild(passwordItem);
      });
    }
  });