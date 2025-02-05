import LongKey from "./LongKey.js";
import Channel from "./Channel.js";
import BufferToBase64 from "./BufferToBase64.js";

export class Terminal {
  constructor() {
    this.longKey = new LongKey();
  }

  initialize = async () => {
    await this.longKey.initialize();
    await this.importKeyPair({
      publicKey: await this.longKey.exportSignPublicKeyString(),
      privateKey: await this.longKey.exportSignPrivateKeyString(),
    });
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
  receiveHandler;
  channelMap = new Map();
  requestMap = new Map();
  responseMap = new Map();
  send = async (address, type, data, filename) => {
    let channel = this.channelMap.get(address);
    if (!channel) {
      if (!this.requestMap.has(address)) {
        const longKey = new LongKey();
        if (await longKey.importVerifyPublicKey(address)) {
          const otherPublicKeyString = await longKey.exportVerifyPublicKeyString();
          const tempChannel = new Channel({
            signPublicKeyData: this.publicKey,
            signPrivateKeyData: this.privateKey,
            verifyPublicKeyData: otherPublicKeyString,
          });
          let resolve;
          const promise = new Promise(r => resolve = r).then((isComplete = true) => {
            if (isComplete) {
              clearTimeout(this.requestMap.get(otherPublicKeyString).timeoutId);
              this.requestMap.delete(otherPublicKeyString);
              this.channelMap.set(otherPublicKeyString, tempChannel);
              return tempChannel;
            } else {
              this.requestMap.delete(otherPublicKeyString);
              return null;
            }
          });
          const timeoutId = setTimeout(resolve, 1000 * 60, false);
          this.requestMap.set(otherPublicKeyString, {
            channel: tempChannel,
            promise,
            resolve,
            timeoutId,
          });
          tempChannel.connect1(
            this.publicKey,
            this.privateKey,
            otherPublicKeyString
          ).then(m => { if (m !== null) { this.sendHandler(JSON.stringify(m)); } else { resolve(false); } });
          if (this.responseMap.has(address)) {
            channel = await Promise.race([
              promise,
              ...this.responseMap.get(address).values(),
            ]);
          } else {
            channel = await promise;
          }
        }
      }
    }
    if (channel !== null) { return this.sendSub(address, type, data, filename); }
  };
  receive = async receiveDataString => {
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
    // console.log(receiveData);
    if (type === 0) {
      if (this.channelMap.has(from)) { return this.receiveSub(receiveData); }
    } else if (this.channelMap.has(from)) {
      // チャンネルがあるにも関わらず、チャンネルの接続申請が来た場合
      // この場合、相手側でチャンネルが消えている可能性がある
      // そのとき、行われるのはチャンネルの再接続であり、ありえるのは type === 1 のみ
      // 今あるチャンネルに確認を取り、接続が切れれば再接続を行う
      if (type === 1) {
        const channel = this.channelMap.get(from);
        const receivePromise = channel.receivePromise;
        await this.sendHandler(JSON.stringify(await channel.send(JSON.stringify({ type: "ping" }))));
        const isTimeout = await Promise.race([
          receivePromise.then(() => false),
          new Promise(r => setTimeout(r, 1000 * 60, true)),
        ]);
        if (isTimeout) {
          await this.channelDelete(from);
          const channel = new Channel({
            signPublicKeyData: this.publicKey,
            signPrivateKeyData: this.privateKey,
            verifyPublicKeyData: from,
          });
          if (this.requestMap.has(from)) { await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000 * 3))); }
          channel.connect2(
            receiveData,
            this.publicKey,
            this.privateKey,
          ).then(async m => {
            if (m !== null) {
              const key = await channel.shortKey.exportOtherPublicKeyString();
              let resolve;
              const promise = new Promise(r => resolve = r).then((isComplete = true) => {
                if (isComplete) {
                  clearTimeout(this.responseMap.get(from).timeoutId);
                  this.responseMap.delete(from);
                  this.channelMap.set(from, channel);
                  return channel;
                } else {
                  this.responseMap.get(from).delete(key);
                  return null;
                }
              });
              const timeoutId = setTimeout(resolve, 1000 * 60, false);
              if (!this.responseMap.has(from)) { this.responseMap.set(from, new Map()); }
              this.responseMap.get(from).set(key, {
                channel,
                promise,
                resolve,
                timeoutId,
              });
              this.sendHandler(JSON.stringify(m));
            }
          });
        }
      }
    } else {
      if (type === 1) {
        const channel = new Channel({
          signPublicKeyData: this.publicKey,
          signPrivateKeyData: this.privateKey,
          verifyPublicKeyData: from,
        });
        if (this.requestMap.has(from)) { await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000 * 3))); }
        channel.connect2(
          receiveData,
          this.publicKey,
          this.privateKey,
        ).then(async m => {
          if (m !== null) {
            const key = await channel.shortKey.exportOtherPublicKeyString();
            let resolve;
            const promise = new Promise(r => resolve = r).then((isComplete = true) => {
              if (isComplete) {
                clearTimeout(this.responseMap.get(from).timeoutId);
                this.responseMap.delete(from);
                this.channelMap.set(from, channel);
                return channel;
              } else {
                this.responseMap.get(from).delete(key);
                return null;
              }
            });
            const timeoutId = setTimeout(resolve, 1000 * 60, false);
            if (!this.responseMap.has(from)) { this.responseMap.set(from, new Map()); }
            this.responseMap.get(from).set(key, {
              channel,
              promise,
              resolve,
              timeoutId,
            });
            this.sendHandler(JSON.stringify(m));
          }
        });
      } else if (type === 2) {
        if (this.requestMap.has(from)) {
          const request = this.requestMap.get(from);
          const channel = request.channel;
          channel.connect3(
            receiveData,
          ).then(async m => {
            if (m !== null) {
              request.resolve(true);
              this.sendHandler(JSON.stringify(m));
            }
          });
        }
      } else if (type === 3) {
        for (const response of this.responseMap.get(from).values()) {
          const channel = response.channel;
          channel.connect4(
            receiveData,
          ).then(async m => {
            if (m) {
              response.resolve(true);
            }
          });
        }
      }
    }
  };
  byteLimit = 1024 ** 3;
  sendSub = async (address, type, data, filename) => {
    // console.log(data);
    const channel = this.channelMap.get(address);
    if (!channel) { return false; }
    channel.indexCount ??= 0;
    channel.indexMap ??= new Map();
    const index = channel.indexCount++;
    let isComplete = true;
    const timestamp = Date.now();
    if (type === "text") {
      const encodeText = new TextEncoder().encode(data);
      if (this.byteLimit < encodeText.length) {
        const indexMap = new Map();
        channel.indexMap.set(index, indexMap);
        const e = (encodeText.length % this.byteLimit) || this.byteLimit;
        const r = encodeText.length - e;
        let i = 0;
        for (let j = 0; j < r; i++) {
          isComplete = false;
          for (let retry = 0; retry < 3; retry++) {
            let resolve;
            const promise = new Promise(r => resolve = r);
            indexMap.set(j, resolve);
            this.sendHandler(JSON.stringify(await channel.send(JSON.stringify({
              type,
              data: BufferToBase64.encode(encodeText.slice(j, j += this.byteLimit)),
              hasNext: true,
              index,
              sequence: i,
              timestamp,
            }))));
            const timeoutId = setTimeout(resolve, 1000 * 15, false);
            const done = await promise;
            clearTimeout(timeoutId);
            resolve(done);
            if (done) {
              isComplete = true;
              break;
            }
          }
          if (!isComplete) { break; }
        }
        if (isComplete) {
          isComplete = false;
          for (let retry = 0; retry < 3; retry++) {
            let resolve;
            const promise = new Promise(r => resolve = r);
            indexMap.set(r, resolve);
            this.sendHandler(JSON.stringify(await channel.send(JSON.stringify({
              type,
              data: BufferToBase64.encode(encodeText.slice(r)),
              hasNext: false,
              index,
              sequence: i,
              timestamp,
            }))));
            const timeoutId = setTimeout(resolve, 1000 * 15, false);
            const done = await promise;
            clearTimeout(timeoutId);
            resolve(done);
            if (done) {
              isComplete = true;
              break;
            }
          }
        }
      } else {
        isComplete = false;
        for (let retry = 0; retry < 3; retry++) {
          let resolve;
          const promise = new Promise(r => resolve = r);
          channel.indexMap.set(index, resolve);
          this.sendHandler(JSON.stringify(await channel.send(JSON.stringify({
            type,
            data,
            hasNext: false,
            index,
            timestamp,
          }))));
          const timeoutId = setTimeout(resolve, 1000 * 15, false);
          const done = await promise;
          clearTimeout(timeoutId);
          resolve(done);
          if (done) {
            isComplete = true;
            break;
          }
        }
      }
      channel.indexMap?.delete(index);
    } else if (type === "file") {
      if (this.byteLimit < data.length) {
        const indexMap = new Map();
        channel.indexMap.set(index, indexMap);
        const e = (data.length % this.byteLimit) || this.byteLimit;
        const r = data.length - e;
        let i = 0;
        for (let j = 0; j < r; i++) {
          isComplete = false;
          for (let retry = 0; retry < 3; retry++) {
            let resolve;
            const promise = new Promise(r => resolve = r);
            indexMap.set(j, resolve);
            this.sendHandler(JSON.stringify(await channel.send(JSON.stringify({
              type,
              data: BufferToBase64.encode(data.slice(j, j += this.byteLimit)),
              hasNext: true,
              index,
              sequence: i,
              timestamp,
              filename,
            }))));
            const timeoutId = setTimeout(resolve, 1000 * 15, false);
            const done = await promise;
            clearTimeout(timeoutId);
            resolve(done);
            if (done) {
              isComplete = true;
              break;
            }
          }
          if (!isComplete) { break; }
        }
        if (isComplete) {
          isComplete = false;
          for (let retry = 0; retry < 3; retry++) {
            let resolve;
            const promise = new Promise(r => resolve = r);
            indexMap.set(r, resolve);
            this.sendHandler(JSON.stringify(await channel.send(JSON.stringify({
              type,
              data: BufferToBase64.encode(data.slice(r)),
              hasNext: false,
              index,
              sequence: i,
              timestamp,
              filename,
            }))));
            const timeoutId = setTimeout(resolve, 1000 * 15, false);
            const done = await promise;
            clearTimeout(timeoutId);
            resolve(done);
            if (done) {
              isComplete = true;
              break;
            }
          }
        }
      } else {
        isComplete = false;
        for (let retry = 0; retry < 3; retry++) {
          let resolve;
          const promise = new Promise(r => resolve = r);
          channel.indexMap.set(index, resolve);
          this.sendHandler(JSON.stringify(await channel.send(JSON.stringify({
            type,
            data: BufferToBase64.encode(data),
            hasNext: false,
            index,
            timestamp,
            filename,
          }))));
          const timeoutId = setTimeout(resolve, 1000 * 15, false);
          const done = await promise;
          clearTimeout(timeoutId);
          resolve(done);
          if (done) {
            isComplete = true;
            break;
          }
        }
      }
      channel.indexMap?.delete(index);
    }
    if (isComplete) {
      return timestamp;
    } else {
      this.channelDelete();
      return false;
    }
  };
  receiveSub = async receiveData => {
    let result = false;
    const channel = this.channelMap.get(receiveData.from);
    if (!channel) { return result; }
    const data = JSON.parse(await channel.receive(receiveData));
    if (data === null) { return result; }
    if (data.type === "ok") {
      const index = channel.indexMap.get(data.index);
      if (data.sequence != null) {
        const resolve = index.get(data.sequence);
        if (resolve) { resolve(true); }
      } else if (index) {
        index(true);
      }
    } else {
      channel.lastIndex ??= -1;
      channel.skipIndexSet ??= new Set();
      if (channel.lastIndex < data.index) {
        for (let i = channel.lastIndex + 1; i <= data.index; i++) {
          channel.skipIndexSet.add(i);
        }
        channel.lastIndex = data.index;
      }
      if (channel.skipIndexSet.has(data.index)) {
        if (data.type === "text") {
          if (data.sequence != null) {
            channel.receiveIndexMap ??= new Map();
            if (!channel.receiveIndexMap.has(data.index)) { channel.receiveIndexMap.set(data.index, new Map()); }
            const indexMap = channel.receiveIndexMap.get(data.index);
            if (!indexMap.has(data.sequence)) {
              indexMap.set(data.sequence, BufferToBase64.decode(data.data));
            }
            if (!data.hasNext) {
              const buffer = new Uint8Array((indexMap.size - 1) * this.byteLimit + indexMap.get(indexMap.size - 1)?.length ?? 0);
              let i = 0;
              for (const [_i, value] of indexMap) {
                buffer.set(value, i);
                i += value.length;
              }
              this.receiveHandler({
                from: receiveData.from,
                type: data.type,
                data: new TextDecoder().decode(buffer),
                index: data.index,
                timestamp: data.timestamp,
              });
              channel.receiveIndexMap.delete(data.index);
              channel.skipIndexSet.delete(data.index);
            }
          } else {
            this.receiveHandler({
              from: receiveData.from,
              type: data.type,
              data: data.data,
              index: data.index,
              timestamp: data.timestamp,
            });
            channel.skipIndexSet.delete(data.index);
          }
        } else if (data.type === "file") {
          if (data.sequence != null) {
            channel.receiveIndexMap ??= new Map();
            if (!channel.receiveIndexMap.has(data.index)) { channel.receiveIndexMap.set(data.index, new Map()); }
            const indexMap = channel.receiveIndexMap.get(data.index);
            if (!indexMap.has(data.sequence)) {
              indexMap.set(data.sequence, BufferToBase64.decode(data.data));
            }
            if (!data.hasNext) {
              const buffer = new Uint8Array((indexMap.size - 1) * this.byteLimit + indexMap.get(indexMap.size - 1)?.length ?? 0);
              let i = 0;
              for (const [_i, value] of indexMap) {
                buffer.set(value, i);
                i += value.length;
              }
              this.receiveHandler({
                from: receiveData.from,
                type: data.type,
                data: buffer,
                index: data.index,
                timestamp: data.timestamp,
                filename: data.filename,
              });
              channel.receiveIndexMap.delete(data.index);
              channel.skipIndexSet.delete(data.index);
            }
          } else {
            this.receiveHandler({
              from: receiveData.from,
              type: data.type,
              data: BufferToBase64.decode(data.data),
              index: data.index,
              timestamp: data.timestamp,
              filename: data.filename,
            });
            channel.skipIndexSet.delete(data.index);
          }
        }
        result = true;
      }
      this.sendHandler(JSON.stringify(await channel.send(JSON.stringify({
        type: "ok",
        index: data.index,
        ...(data.sequence != null ? { sequence: data.sequence } : {}),
      }))));
    }
    return result;
  };

  channelDelete = async address => {
    const channel = this.channelMap.get(address);
    if (channel) {
      this.channelMap.delete(address);
    }
  };
}
export default Terminal;
