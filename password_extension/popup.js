// popup.js
import { hashPassword } from "./hash.js";
import {
  getKeyFromPassword,
  encryptData,
  decryptData,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "./crypto.js";
import {savePasswordToStorage, getPasswordFromStorage, clearStorage,} from "./storage.js";
import { displayMessage } from "./utils.js";

document.addEventListener("DOMContentLoaded", function () {
  const masterPasswordDiv = document.getElementById("master-password-setup");
  const masterPasswordInput = document.getElementById("master-password");
  const setMasterPasswordBtn = document.getElementById(
    "set-master-password-btn"
  );
  const appDiv = document.getElementById("app");
  const verifyMasterPasswordInput = document.getElementById(
    "verify-master-password"
  );
  const verifyBtn = document.getElementById("verify-btn");
  const generateBtn = document.getElementById("generate-btn");
  const saveBtn = document.getElementById("save-btn");
  const deleteBtn = document.getElementById("delete-btn");
  const saveToFileBtn = document.getElementById("save-to-file-btn");
  const passwordField = document.getElementById("generated-password");
  const tagInput = document.getElementById("tag-input");
  const messageDiv = document.getElementById("message");
  const verifyMessageDiv = document.getElementById("verify-message");
  const retrievedPasswordsDiv = document.getElementById("retrieved-passwords");
  const tooltipElements = document.querySelectorAll("[data-tooltip]");
  const passwordTitle = document.getElementById("password-title");

  tooltipElements.forEach(function (elem) {
    // Create tooltip container
    const tooltipContainer = document.createElement("div");
    tooltipContainer.classList.add("tooltip");

    // Create tooltip text element
    const tooltipText = document.createElement("span");
    tooltipText.classList.add("tooltiptext");
    tooltipText.textContent = elem.getAttribute("data-tooltip");

    // Wrap the button in the tooltip container
    elem.parentNode.insertBefore(tooltipContainer, elem);
    tooltipContainer.appendChild(elem);
    tooltipContainer.appendChild(tooltipText);
  });

  chrome.storage.local.get(["masterPasswordHash"], function (result) {
    if (result.masterPasswordHash) {
      masterPasswordDiv.style.display = "none";
      appDiv.style.display = "block";
    } else {
      masterPasswordDiv.style.display = "block";
      appDiv.style.display = "none";
    }
  });

  setMasterPasswordBtn.addEventListener("click", async function () {
    const masterPassword = masterPasswordInput.value;
    if (masterPassword) {
      try {
        const masterPasswordHash = await hashPassword(masterPassword);
        chrome.storage.local.set({ masterPasswordHash }, function () {
          masterPasswordDiv.style.display = "none";
          appDiv.style.display = "block";
        });
      } catch (error) {
        displayMessage(
          messageDiv,
          `Error setting master password: ${error.message}`
        );
      }
    } else {
      displayMessage(messageDiv, "Please enter a master password!");
    }
  });

  verifyBtn.addEventListener("click", async function () {
    const enteredPassword = verifyMasterPasswordInput.value;
    chrome.storage.local.get(["masterPasswordHash"], async function (result) {
      try {
        const masterPasswordHash = result.masterPasswordHash;
        const enteredPasswordHash = await hashPassword(enteredPassword);
        if (enteredPasswordHash === masterPasswordHash) {
          verifyMessageDiv.textContent = "";
          verifyMasterPasswordInput.style.display = "none";
          verifyBtn.style.display = "none";
          passwordField.style.display = "block";
          generateBtn.style.display = "block";
          tagInput.style.display = "block";
          saveBtn.style.display = "block";
          deleteBtn.style.display = "block";
          saveToFileBtn.style.display = "block";
          passwordTitle.style.display = "block";
          retrievePasswords();
        } else {
          verifyMessageDiv.textContent = "Incorrect master password!";
        }
      } catch (error) {
        verifyMessageDiv.textContent = `Error verifying password: ${error.message}`;
      }
    });
  });

  generateBtn.addEventListener("click", generatePassword);
  saveBtn.addEventListener("click", savePassword);
  deleteBtn.addEventListener("click", deletePasswords);
  saveToFileBtn.addEventListener("click", savePasswordsToFile);

  function generatePassword() {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let password = "";
    for (let i = 0, n = charset.length; i < 18; ++i) {
      password += charset.charAt(Math.floor(Math.random() * n));
    }
    passwordField.value = password;
    messageDiv.textContent = "";
  }

  async function savePassword() {
    const password = passwordField.value;
    const masterPassword = verifyMasterPasswordInput.value;
    const tag = tagInput.value;

    if (!masterPassword) {
      displayMessage(messageDiv, "Please enter the master password!");
      return;
    }

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await getKeyFromPassword(masterPassword, salt);

    if (password && tag) {
      try {
        const encryptedPassword = await encryptData(password, key);
        getPasswordFromStorage(function (result) {
          const passwords = result.passwords;
          passwords.push({
            tag,
            salt: arrayBufferToBase64(salt),
            encryptedPassword,
          });
          savePasswordToStorage(passwords, function () {
            displayMessage(messageDiv, "Password saved successfully!");
          });
        });
      } catch (error) {
        displayMessage(messageDiv, `Error saving password: ${error.message}`);
      }
    } else {
      displayMessage(messageDiv, "Generate a password and provide a tag!");
    }
  }

  async function retrievePasswords() {
    const masterPassword = verifyMasterPasswordInput.value;
    if (!masterPassword) {
      displayMessage(messageDiv, "Please enter the master password!");
      return;
    }

    getPasswordFromStorage(async function (result) {
      try {
        const passwords = result.passwords;
        const decryptedPasswords = [];
        for (const { tag, salt, encryptedPassword } of passwords) {
          const key = await getKeyFromPassword(
            masterPassword,
            base64ToArrayBuffer(salt)
          );
          const decryptedPassword = await decryptData(encryptedPassword, key);
          decryptedPasswords.push({ tag, password: decryptedPassword });
        }
        displayRetrievedPasswords(decryptedPasswords);
      } catch (error) {
        displayMessage(
          messageDiv,
          `Error retrieving passwords: ${error.message}`
        );
      }
    });
  }

  async function savePasswordsToFile() {
    const saveMethod = prompt(
      'Save passwords as plain text or encrypted? (Enter "plain" or "encrypted")'
    );
    if (saveMethod === "plain" || saveMethod === "encrypted") {
      getPasswordFromStorage(async function (result) {
        const passwords = result.passwords;
        const passwordList = [];

        for (const { tag, encryptedPassword, salt } of passwords) {
          let password = "";
          if (saveMethod === "encrypted") {
            password = JSON.stringify(encryptedPassword);
          } else {
            const masterPassword = verifyMasterPasswordInput.value;
            const key = await getKeyFromPassword(
              masterPassword,
              base64ToArrayBuffer(salt)
            );
            password = await decryptData(encryptedPassword, key);
          }
          passwordList.push({ tag, password });
        }

        const blob = new Blob([JSON.stringify(passwordList, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "passwords.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    } else {
      displayMessage(
        messageDiv,
        'Invalid option. Choose either "plain" or "encrypted".'
      );
    }
  }

  function deletePasswords() {
    clearStorage(function () {
      displayMessage(messageDiv, "All passwords deleted successfully!");
    });
  }

  function displayRetrievedPasswords(passwords) {
    passwords.forEach(({ tag, password }) => {
      const passwordItem = document.createElement("div");
      passwordItem.classList.add("password-item");

      const tagDiv = document.createElement("div");
      tagDiv.classList.add("tag");
      tagDiv.textContent = tag;

      const passwordContainer = document.createElement("div");
      passwordContainer.classList.add("password-container");

      const passwordDiv = document.createElement("input");
      passwordDiv.classList.add("password");
      passwordDiv.type = "password";
      passwordDiv.value = password;
      passwordDiv.readOnly = true;

      const toggleButton = document.createElement("button");
      toggleButton.textContent = "Show";
      toggleButton.classList.add("toggle-btn");
      toggleButton.addEventListener("click", () => {
        if (passwordDiv.type === "password") {
          passwordDiv.type = "text";
          toggleButton.textContent = "Hide";
        } else {
          passwordDiv.type = "password";
          toggleButton.textContent = "Show";
        }
      });

      const copyButton = document.createElement("button");
      copyButton.textContent = "Copy";
      copyButton.classList.add("copy-btn");
      copyButton.addEventListener("click", () => {
        const originalType = passwordDiv.type;
        passwordDiv.type = "text";
        passwordDiv.select();
        document.execCommand("copy");
        passwordDiv.type = originalType;

        copyButton.textContent = "Copied";
        setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 2000);
      });

      passwordContainer.appendChild(passwordDiv);
      passwordContainer.appendChild(toggleButton);
      passwordContainer.appendChild(copyButton);

      passwordItem.appendChild(tagDiv);
      passwordItem.appendChild(passwordContainer);

      retrievedPasswordsDiv.appendChild(passwordItem);
    });
  }
});
