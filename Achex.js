import BufferToBase64 from "./BufferToBase64.js";

// このクラスは、AchexのAPIを使うためのクラス
// 基本的な動作のみを実装する
export class Achex extends EventTarget {
  // ハブはちゃんと抜けてから違うハブに入らないとバグる？
  static eventNameList = [
    "my-auth",
    "my-joinHub",
    "my-leaveHub",
    "my-leftHub",
    "my-to",
    "my-toS",
    "my-toH",
    "my-ping",
    "my-echo",
    "my-serverstat",
    "my-error",
    "my-message",
    "my-socketClose",
    "my-socketError",
    "my-socketMessage",
    "my-socketOpen",
  ];
  static URL = "wss://cloud.achex.ca/";
  // あんまり意味ない？ (違うインスタンスでも聞ける)
  instanceName = "";
  defaultInstanceName = "jddgSPFbVJAJibBB"; // 適当
  hubname = null;
  defaultHubname = "C4zQQiZ1Ij4SgCnj"; // 適当
  sessionID = null;
  socket = null;
  constructor(instance, username = BufferToBase64.encode(window.crypto.getRandomValues(new Uint8Array(32))), password = BufferToBase64.encode(window.crypto.getRandomValues(new Uint8Array(32)))) {
    super();
    this.instanceName = encodeURIComponent(String(instance ?? this.defaultInstanceName));
    this.url = `${this.constructor.URL}${this.instanceName}`;
    this.username = username;
    // あんまり意味ない？ (用途不明)
    this.password = password;
  }

  parseMessage = (data, type) => (!/^(to|toS|toH|echo)$/.test(type) || this.sessionID == null) ? null : {
    type,
    from: type === "echo" ? {
      username: this.username,
      sessionID: this.sessionID,
    } : {
      username: data.FROM,
      sessionID: data.sID,
    },
    self: {
      username: this.username,
      sessionID: this.sessionID,
    },
    message: data[""],
  };

  send = data => {
    console.log("send\n", data);
    if (!this.socket) {
      this.socketErrorListener({ detail: "socket is not connected", });
    } else {
      this.socket.send(data);
    }
    return this;
  };
  connect = () => {
    if (this.socket) { this.disconnect(); }
    console.log("Connecting to the server...");
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("close", this.socketCloseListener, { passive: true, });
    this.socket.addEventListener("error", this.socketErrorListener, { passive: true, });
    this.socket.addEventListener("message", this.socketMessageListener, { passive: true, });
    this.socket.addEventListener("open", this.socketOpenListener, { passive: true, });
    return this;
  };
  disconnect = () => {
    console.log("Disconnecting from the server...");
    this.socket?.close();
    this.socket = null;
    return this;
  };

  socketCloseListener = event => {
    console.log("socket close\n", event);
    this.dispatchEvent(new CustomEvent("my-socketClose", { detail: event, }));
    this.disconnect();
  };
  socketErrorListener = event => {
    console.log("socket error\n", event);
    this.dispatchEvent(new CustomEvent("my-socketError", { detail: event, }));
    this.disconnect();
  };
  socketMessageListener = event => {
    console.log("socket message\n", event);
    this.dispatchEvent(new CustomEvent("my-socketMessage", { detail: event, }));
    const data = {
      // self: this,
    };
    try {
      // JSON以外を送信するとJSON以外が返ってくるのでそこでエラーになる？
      Object.assign(data, JSON.parse(event.data));
    } catch (error) {
      console.error(error);
      return;
    }
    const type = event.data.match(/"(auth|joinHub|leaveHub|leftHub|to|toS|toH|ltcy|echo|version|error)":/)?.[1] ?? "none";
    console.log("message type\n", type, "\nmessage data\n", data);
    switch (type) {
      case "auth":
        this.sessionID = data.SID;
        console.log("message auth");
        this.dispatchEvent(new CustomEvent("my-auth", { detail: [data, type], }));
        break;
      case "joinHub":
        // 自分にだけ送られる
        console.log("message joinHub");
        this.dispatchEvent(new CustomEvent("my-joinHub", { detail: [data, type], }));
        break;
      case "leaveHub":
        // 何も送られない
        console.log("message leaveHub");
        this.dispatchEvent(new CustomEvent("my-leaveHub", { detail: [data, type], }));
        break;
      case "leftHub":
        // 自分以外に送られる
        console.log("message leftHub");
        this.dispatchEvent(new CustomEvent("my-leftHub", { detail: [data, type], }));
        break;
      case "to":
        console.log("message to");
        this.dispatchEvent(new CustomEvent("my-to", { detail: [data, type], }));
        this.dispatchEvent(new CustomEvent("my-message", { detail: [data, type], }));
        break;
      case "toS":
        console.log("message toS");
        this.dispatchEvent(new CustomEvent("my-toS", { detail: [data, type], }));
        this.dispatchEvent(new CustomEvent("my-message", { detail: [data, type], }));
        break;
      case "toH":
        // to, toS と違って自分には送られない
        console.log("message toH");
        this.dispatchEvent(new CustomEvent("my-toH", { detail: [data, type], }));
        this.dispatchEvent(new CustomEvent("my-message", { detail: [data, type], }));
        break;
      case "ltcy":
        // 返答なし
        console.log("message ping");
        this.dispatchEvent(new CustomEvent("my-ping", { detail: [data, type], }));
        break;
      case "echo":
        // 自分自身にのみ返ってくる
        console.log("message echo");
        this.dispatchEvent(new CustomEvent("my-echo", { detail: [data, type], }));
        this.dispatchEvent(new CustomEvent("my-message", { detail: [data, type], }));
        break;
      case "version":
        console.log("message serverstat");
        this.dispatchEvent(new CustomEvent("my-serverstat", { detail: [data, type], }));
        break;
      default:
        console.log("message error");
        this.dispatchEvent(new CustomEvent("my-error", { detail: [data, type], }));
        break;
    }
  };
  socketOpenListener = event => {
    console.log("open", event);
    this.dispatchEvent(new CustomEvent("my-socketOpen", { detail: event, }));
    this.auth(this.username, this.password);
  };

  auth = (auth = this.username, passwd = this.password) => {
    this.send(JSON.stringify({ auth, passwd, }));
    return this;
  };
  joinHub = (hubname = this.defaultHubname) => {
    // 本当は今いるハブから抜けてから入るようにしたいけど、このクラスを使う側に任せる
    this.send(JSON.stringify({ joinHub: hubname, }));
    return this;
  };
  leaveHub = (hubname = this.hubname ?? this.defaultHubname) => {
    // 基本は今いるハブから抜ける
    this.send(JSON.stringify({ leaveHub: hubname, }));
    return this;
  };
  to = (message, username = this.username) => {
    this.send(JSON.stringify({ to: username, "": message, }));
    return this;
  };
  toS = (message, sessionID = this.sessionID) => {
    this.send(JSON.stringify({ toS: sessionID, "": message, }));
    return this;
  };
  toH = (message, hubname = this.hubname ?? this.defaultHubname) => {
    this.send(JSON.stringify({ toH: hubname, "": message }));
    return this;
  };
  ping = () => {
    // this.send(JSON.stringify({ ping: true }));
    this.send('{"ping":true}');
    return this;
  };
  echo = message => {
    this.send(JSON.stringify({ echo: true, "": message, }));
    return this;
  };
  serverstat = () => {
    // this.send(JSON.stringify({ serverstat: true }));
    this.send('{"serverstat":true}');
    return this;
  };
}
export default Achex;

// async function test() {
//   const achex = new Achex();
//   achex.addEventListener("my-message", function ({ detail }) { console.log("1\n", this.parseMessage(...detail)) });
//   const authPromise = new Promise(r => achex.addEventListener("my-auth", r, { passive: true, once: true, }));
//   achex.connect();
//   await authPromise;
//   const joinHubPromise = new Promise(r => achex.addEventListener("my-joinHub", r, { passive: true, once: true, }));
//   achex.joinHub();
//   await joinHubPromise;
//   return achex;
// };
