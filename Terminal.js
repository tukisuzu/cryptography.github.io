import LongKey from "./LongKey.js";
import Channel from "./Channel.js";

export class Terminal {
  channelMap = new Map();
  connectMap = new Map();
  constructor() {
    this.longKey = new LongKey();
  }

  initialize = async () => {
    await this.longKey.initialize();
    return this;
  };

  publicKey;
  privateKey;
  importKeyPair = async ({ publicKey, privateKey }) => {
    const oldPublicKey = this.longKey.signPublicKey;
    const oldPrivateKey = this.longKey.signPrivateKey;
    if (
      !(await this.longKey.importSignPublicKey(publicKey)) ||
      !(await this.longKey.importSignPrivateKey(privateKey))
    ) {
      this.longKey.publicKey = oldPublicKey;
      this.longKey.privateKey = oldPrivateKey;
      return false;
    }
    this.publicKey = await this.longKey.exportSignPublicKeyString();
    this.privateKey = await this.longKey.exportSignPrivateKeyString();
    return true;
  };
  exportKeyPair = async () => {
    return {
      publicKey: await this.longKey.exportSignPublicKeyString(),
      privateKey: await this.longKey.exportSignPrivateKeyString(),
    };
  };

  sendHandler;
  breakHandler;
  send = async (address, type, data, options) => {
    // 失敗要因
    // 1. 接続に失敗した
    // 2. 返信が来ない
    const channel = await this.channelGet(address);
    if (type === "text") {
    } else if (type === "file") {
    } else if (type === "ping") {
    } else if (type === "close") {
    }
  };
  receive = async receiveDataString => {
    try {
      const receiveData = (() => { try { return JSON.parse(receiveDataString); } catch (error) { return {}; } })();
      const {
        type,
        from,
        to,
      } = receiveData;
      if (
        type === undefined ||
        to !== this.publicKey
      ) { return; }
      if (type === 0) {
      } else {
        if (this.channelMap.has(from)) {
          // チャンネルがあるにも関わらず、チャンネルの接続申請が来た場合
          if (type === 1) {
            // この場合、相手側でチャンネルが消えている可能性がある
            // そのとき、行われるのはチャンネルの再接続であり、ありえるのは type === 1 のみ
            // 今あるチャンネルに確認を取り、接続が切れれば再接続を行う
            const channel = this.channelMap.get(from);
            const receivePromise = channel.receivePromise;
            await this.send(from, "ping");
            const isTimeout = await Promise.race([
              receivePromise.then(() => false),
              new Promise(r => setTimeout(r, 1000 * 60, true)),
            ]);
            if (isTimeout) {
              await this.channelDelete(from);
            }
          }
        } else if (this.connectMap.has(from)) {
          // チャンネル接続中にチャンネルの接続申請が来た場合
        } else {
          // チャンネルがない場合
          // ありえるのは type === 1 のチャンネル接続要求のみ
          if (type === 1) {
            const channel = new Channel({
              signPublicKeyData: this.publicKey,
              signPrivateKeyData: this.privateKey,
              verifyPublicKeyData: from,
            });
            channel.connect2(
              receiveData,
              this.publicKey,
              this.privateKey,
            ).then(m => {
              if (m !== null) {
                let resolve;
                const promise = new Promise(r => resolve = r).then((isComplete = true) => {
                  if (isComplete) {
                    clearTimeout(this.connectMap.get(from).timeoutId);
                    this.connectMap.delete(from);
                    return channel;
                  } else {
                    this.connectMap.delete(from);
                    return null;
                  }
                });
                const timeoutId = setTimeout(resolve, 1000 * 60, false);
                this.connectMap.set(from, {
                  channel,
                  promise,
                  resolve,
                  timeoutId,
                });
                this.sendHandler(m);
              }
            });
          }
        }
      }
    } catch (error) { console.error(error); }
  };

  send = async (address, type, data, options) => { };
  receive = async receiveDataString => { };
  requestMap = new Map();
  responseMap = new Map();

  channelGet = async address => {
  };
  channelSet = async address => {
  };
  channelDelete = async address => {
  };
  connectRequest = async otherPublicKey => {
    const longKey = new LongKey();
    if (await longKey.importVerifyPublicKey(otherPublicKey)) {
      const otherPublicKeyString = await longKey.exportVerifyPublicKeyString();
      // 1. 既に接続が確立している場合
      //    接続が無事かどうかの確認を行う
      // 2. 未だ接続が確立していない場合
      //   a. 既に接続申請を行っている場合
      //     そのまま待機する
      //   b. 未だ接続申請を行っていない場合
      //     接続申請を行う
      if (this.channelMap.has(otherPublicKeyString)) {
        return this.channelMap.get(otherPublicKeyString);
      }
      if (!this.connectMap.has(otherPublicKeyString)) {
        const channel = new Channel({
          signPublicKeyData: this.publicKey,
          signPrivateKeyData: this.privateKey,
          verifyPublicKeyData: otherPublicKeyString,
        });
        channel.connect1(
          this.publicKey,
          this.privateKey,
          otherPublicKeyString
        ).then(m => { if (m !== null) { this.sendHandler(m); } });
        let resolve;
        const promise = new Promise(r => resolve = r).then((isComplete = true) => {
          if (isComplete) {
            clearTimeout(this.connectMap.get(otherPublicKeyString).timeoutId);
            this.connectMap.delete(otherPublicKeyString);
            return channel;
          } else {
            this.connectMap.delete(otherPublicKeyString);
            return null;
          }
        });
        const timeoutId = setTimeout(resolve, 1000 * 60, false);
        this.connectMap.set(otherPublicKeyString, {
          channel,
          promise,
          resolve,
          timeoutId,
        });
      }
      return this.connectMap.get(otherPublicKeyString).promise;
    }
    return null;
  };
  connectResponse = async otherPublicKey => {
    if (await this.longKey.importVerifyPublicKey(otherPublicKey)) {
      const otherPublicKey = await this.longKey.exportVerifyPublicKeyString();
      const channel = new Channel({
        signPublicKeyData: this.publicKey,
        signPrivateKeyData: this.privateKey,
        verifyPublicKeyData: otherPublicKey,
      });
    }
  };
}
export default Terminal;
