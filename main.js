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
  if (newAddress) {
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

ws.terminal.receiveHandler = ({ from, type, data, timestamp }) => {
  if (type === "text") {
    if (!conversations.has(from)) {
      const addressList = document.getElementById("addressList");
      const option = document.createElement("option");
      option.value = from;
      option.text = from;
      option.title = from; // 長いアドレスに対応
      addressList.add(option);
      conversations.set(from, []);
    }
    addMessageToConversation(from, "received", data, timestamp);
  }
};

function addMessageToConversation(address, type, message, timestamp) {
  const conversation = conversations.get(address) || [];
  conversation.push({ type, message, timestamp });
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
  conversation.forEach(({ type, message, timestamp }) => {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${type}`;
    const timeString = new Date(timestamp).toLocaleTimeString();
    messageElement.innerHTML = `<span>${message}</span><br><small>${timeString}</small>`;
    conversationElement.appendChild(messageElement);
  });
  conversationElement.scrollTop = conversationElement.scrollHeight;
}
