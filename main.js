/**
 * @file Main file for the application
 * @version 1.0.0
 * @author suzuki
 * @copyright All rights reserved.
 * @license "All rights reserved"
 */

import WS from "./WS.js";
window.WS = WS;

const loadingScreen = document.getElementById("loading-screen");

try {
  window.ws = await new WS().initialize();
  // ws.terminal.receiveHandler = console.log;
} catch (error) {
  console.error("WebSocket initialization failed:", error);
  loadingScreen.innerHTML = "読み込みに失敗しました。ページを再読み込みしてください。";
} finally {
  if (window.ws) {
    loadingScreen.style.display = "none";
  }
}

document.getElementById("generateKey").addEventListener("click", async () => {
  await ws.terminal.initialize();
  alert("鍵が生成されました");
});

document.getElementById("importKey").addEventListener("click", async () => {
  const publicKey = document.getElementById("inputPublicKey").value;
  const privateKey = document.getElementById("inputPrivateKey").value;
  const success = await ws.terminal.importKeyPair({ publicKey, privateKey });
  if (success) {
    alert("鍵がインポートされました");
  } else {
    alert("鍵のインポートに失敗しました");
  }
});

document.getElementById("exportKey").addEventListener("click", async () => {
  const { publicKey, privateKey } = await ws.terminal.exportKeyPair();
  document.getElementById("outputKey").value = `公開鍵: ${publicKey}\n秘密鍵: ${privateKey}`;
});

document.getElementById("downloadKey").addEventListener("click", async () => {
  const { publicKey, privateKey } = await ws.terminal.exportKeyPair();
  const blob = new Blob([`公開鍵: ${publicKey}\n秘密鍵: ${privateKey}`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "keypair.txt";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("homeButton").addEventListener("click", () => {
  document.getElementById("home").style.display = "block";
  document.getElementById("setting").style.display = "none";
}, { passive: true });

document.getElementById("settingButton").addEventListener("click", () => {
  document.getElementById("home").style.display = "none";
  document.getElementById("setting").style.display = "block";
}, { passive: true });

const conversations = new Map();

document.getElementById("addAddress").addEventListener("click", () => {
  const newAddress = document.getElementById("newAddress").value;
  const alias = document.getElementById("alias").value || newAddress;
  if (newAddress && !conversations.has(newAddress) && ws.terminal.publicKey !== newAddress) {
    const addressList = document.getElementById("addressList");
    const option = document.createElement("option");
    option.value = newAddress;
    option.text = alias;
    option.title = newAddress; // 長いアドレスに対応
    addressList.add(option);
    document.getElementById("newAddress").value = "";
    document.getElementById("alias").value = "";
    conversations.set(newAddress, []);
  }
});

document.getElementById("addressList").addEventListener("change", () => {
  const address = document.getElementById("addressList").value;
  displayConversation(address);
});

document.getElementById("sendMessage").addEventListener("click", async () => {
  const address = document.getElementById("addressList").value;
  const message = document.getElementById("message").value;
  if (address && message) {
    const timestamp = await ws.terminal.send(address, "text", message);
    if (timestamp !== false) {
      addMessageToConversation(address, "sent", message, timestamp);
      document.getElementById("message").value = "";
    } else {
      alert("メッセージの送信に失敗しました");
    }
  }
});

document.getElementById("sendFile").addEventListener("change", async (event) => {
  const address = document.getElementById("addressList").value;
  const file = event.target.files[0];
  if (address && file) {
    const reader = new FileReader();
    reader.onload = async () => {
      const fileBuffer = new Uint8Array(reader.result);
      const timestamp = await ws.terminal.send(address, "file", fileBuffer, file.name);
      if (timestamp !== false) {
        addMessageToConversation(address, "sent", file.name, timestamp, "file", fileBuffer);
      } else {
        alert("ファイルの送信に失敗しました");
      }
    };
    reader.readAsArrayBuffer(file);
  }
});

ws.terminal.receiveHandler = ({ from, type, data, timestamp, filename }) => {
  if (!conversations.has(from)) {
    const addressList = document.getElementById("addressList");
    const option = document.createElement("option");
    option.value = from;
    option.text = from;
    option.title = from; // 長いアドレスに対応
    addressList.add(option);
    conversations.set(from, []);
  }
  if (type === "text") {
    addMessageToConversation(from, "received", data, timestamp);
  } else if (type === "file") {
    addMessageToConversation(from, "received", filename, timestamp, "file", data);
  }
};

function addMessageToConversation(address, type, message, timestamp, messageType = "text", fileData = null) {
  const conversation = conversations.get(address) || [];
  conversation.push({ type, message, timestamp, messageType, fileData });
  conversation.sort((a, b) => a.timestamp - b.timestamp);
  conversations.set(address, conversation);
  if (document.getElementById("addressList").value === address) {
    displayConversation(address);
  }
}

function displayConversation(address) {
  const conversation = conversations.get(address) || [];
  const conversationElement = document.getElementById("conversation");
  conversationElement.innerHTML = "";
  conversation.forEach(({ type, message, timestamp, messageType, fileData }) => {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${type}`;
    const timeString = new Date(timestamp).toLocaleTimeString();
    if (messageType === "text") {
      messageElement.innerHTML = `<span>${message}</span><br><small>${timeString}</small>`;
    } else if (messageType === "file") {
      const fileUrl = URL.createObjectURL(new Blob([fileData]));
      if (message.match(/\.(jpe?g|png|gif|webp)$/i)) {
        messageElement.innerHTML = `<img src="${fileUrl}" alt="${message}" style="max-width: 100%;"><br><small>${timeString}</small>`;
      } else if (message.match(/\.(mp3|wav)$/i)) {
        messageElement.innerHTML = `<audio controls src="${fileUrl}"></audio><br><small>${timeString}</small>`;
      } else if (message.match(/\.(mp4|webm)$/i)) {
        messageElement.innerHTML = `<video controls src="${fileUrl}" style="max-width: 100%;"></video><br><small>${timeString}</small>`;
      } else {
        messageElement.innerHTML = `<a href="${fileUrl}" download="${message}">${message}</a><br><small>${timeString}</small>`;
      }
    }
    conversationElement.appendChild(messageElement);
  });
  setTimeout(() => conversationElement.scrollTop = conversationElement.scrollHeight, 0);
}
