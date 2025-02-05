import LongKey from "./LongKey.js";
import ShortKey from "./ShortKey.js";

/**
 * 一対一の通信を管理する  
 * @class
 * @public
 */
export class Channel {
  /**
   * 長期鍵  
   * @member
   * @public
   * @type {LongKey}
   */
  longKey;
  /**
   * 短期鍵  
   * @member
   * @public
   * @type {ShortKey}
   */
  shortKey;
  /**
   * 通信が確立しているか  
   * @member
   * @public
   * @type {boolean}
   * @default false
   */
  isConnect = false;

  /**
   * コンストラクタ  
   * @constructor
   * @public
   * @param {Object} [options={}] オプション
   * @param {string} [options.signPublicKeyData] 自分の公開鍵
   * @param {string} [options.signPrivateKeyData] 自分の秘密鍵
   * @param {string} [options.verifyPublicKeyData] 相手の公開鍵
   * @returns {this}
   */
  constructor({
    signPublicKeyData,
    signPrivateKeyData,
    verifyPublicKeyData,
  } = {}) {
    this.longKey = new LongKey({
      signPublicKeyData,
      signPrivateKeyData,
      verifyPublicKeyData,
    });
    this.shortKey = new ShortKey();
  }

  /**
   * 初期化  
   * @method
   * @public
   * @returns {Promise<this>}
   */
  initialize = async () => {
    this.isConnect = false;
    this.selfAddress = undefined;
    this.otherAddress = undefined;
    await this.longKey.initialize();
    return this;
  };



  /**
   * 自分の公開鍵をエクスポートする  
   * @method
   * @public
   * @returns {Promise<string>} 自分の公開鍵
   */
  exportSelfPublicKey = async () => await this.longKey.exportSignPublicKeyString();
  /**
   * 自分の秘密鍵をエクスポートする  
   * @method
   * @public
   * @returns {Promise<string>} 自分の秘密鍵
   */
  exportSelfPrivateKey = async () => await this.longKey.exportSignPrivateKeyString();

  /**
   * 自分のアドレスを設定する  
   * @method
   * @public
   * @param {string} publicKeyData 自分の公開鍵
   * @param {string} privateKeyData 自分の秘密鍵
   * @returns {Promise<boolean>} 成功したか
   */
  setSelfAddress = async (publicKeyData, privateKeyData) => {
    if (
      !(await this.longKey.importSignPublicKey(publicKeyData)) ||
      !(await this.longKey.importSignPrivateKey(privateKeyData))
    ) { return false; }
    return true;
  };
  /**
   * 相手のアドレスを設定する  
   * @method
   * @public
   * @param {string} publicKeyData 相手の公開鍵
   * @returns {Promise<boolean>} 成功したか
   */
  setOtherAddress = async publicKeyData => {
    if (
      !(await this.longKey.importVerifyPublicKey(publicKeyData))
    ) { return false; }
    return true;
  };

  /**
   * 自分のアドレス(公開鍵)の文字列  
   * @member
   * @public
   * @type {string|undefined}
   */
  selfAddress;
  /**
   * 自分のアドレス(公開鍵)を取得する  
   * @method
   * @public
   * @returns {Promise<string>} 自分のアドレス(公開鍵)
   */
  getSelfAddress = async () => this.longKey.exportSignPublicKeyString();
  /**
   * 相手のアドレス(公開鍵)の文字列  
   * @member
   * @public
   * @type {string|undefined}
   */
  otherAddress;
  /**
   * 相手のアドレス(公開鍵)を取得する  
   * @method
   * @public
   * @returns {Promise<string>} 相手のアドレス(公開鍵)
   */
  getOtherAddress = async () => this.longKey.exportVerifyPublicKeyString();



  /**
   * メッセージを作成する  
   * @method
   * @public
   * @param {number} type メッセージの種類
   * @param {Object} data メッセージのデータ
   * @returns {Object} メッセージ
   */
  createMessage = (type, data) => {
    return {
      type,
      from: this.selfAddress,
      to: this.otherAddress,
      ...data,
    };
  };

  /**
   * 通信開始手続き1 (A -> B)  
   * @method
   * @public
   * @param {string} selfPublicKeyData 自分の公開鍵
   * @param {string} selfPrivateKeyData 自分の秘密鍵
   * @param {string} otherPublicKeyData 相手の公開鍵
   * @returns {Promise<?Object>} メッセージ (null: 失敗)
   */
  connect1 = async (
    selfPublicKeyData,
    selfPrivateKeyData,
    otherPublicKeyData,
  ) => {
    if (
      !(await this.setSelfAddress(selfPublicKeyData, selfPrivateKeyData)) ||
      !(await this.setOtherAddress(otherPublicKeyData))
    ) { return null; }
    this.selfAddress = await this.getSelfAddress();
    this.otherAddress = await this.getOtherAddress();
    await this.shortKey.initialize();
    const key = await this.shortKey.exportPublicKeyString();
    const signature = await this.longKey.signMessageString(key);
    return this.createMessage(1, {
      key,
      signature,
    });
  };
  /**
   * 通信開始手続き2 (B -> A)  
   * @method
   * @public
   * @param {Object} receiveMessage 受信したメッセージ
   * @param {string} selfPublicKeyData 自分の公開鍵
   * @param {string} selfPrivateKeyData 自分の秘密鍵
   * @returns {Promise<?Object>} メッセージ (null: 失敗)
   */
  connect2 = async (
    receiveMessage,
    selfPublicKeyData,
    selfPrivateKeyData,
  ) => {
    if (
      receiveMessage.type !== 1 ||
      !(await this.setSelfAddress(selfPublicKeyData, selfPrivateKeyData)) ||
      receiveMessage.to !== (this.selfAddress = await this.getSelfAddress()) ||
      !(await this.setOtherAddress(receiveMessage.from)) ||
      !(await this.longKey.verifyMessageString(receiveMessage.key, receiveMessage.signature))
    ) { return null; }
    this.otherAddress = await this.getOtherAddress();
    await this.shortKey.initialize();
    if (
      !(await this.shortKey.importOtherPublicKey(receiveMessage.key)) ||
      !(await this.shortKey.deriveKey())
    ) { return null; }
    const key = await this.shortKey.exportPublicKeyString();
    const signature = await this.longKey.signMessageString(key);
    const finish = await this.shortKey.encryptMessageString("finish");
    return this.createMessage(2, {
      key,
      signature,
      finish,
    });
  };
  /**
   * 通信開始手続き3 (A -> B)  
   * @method
   * @public
   * @param {Object} receiveMessage 受信したメッセージ
   * @returns {Promise<?Object>} メッセージ (null: 失敗)
   */
  connect3 = async receiveMessage => {
    if (
      receiveMessage.type !== 2 ||
      receiveMessage.to !== this.selfAddress ||
      receiveMessage.from !== this.otherAddress ||
      !(await this.longKey.verifyMessageString(receiveMessage.key, receiveMessage.signature)) ||
      !(await this.shortKey.importOtherPublicKey(receiveMessage.key)) ||
      !(await this.shortKey.deriveKey()) ||
      await this.shortKey.decryptMessageString(receiveMessage.finish) !== "finish"
    ) { return null; }
    this.isConnect = true;
    const finish = await this.shortKey.encryptMessageString("finish");
    return this.createMessage(3, {
      finish,
    });
  };
  /**
   * 通信開始手続き4 (B)  
   * @method
   * @public
   * @param {Object} receiveMessage 受信したメッセージ
   * @returns {Promise<?boolean>} 成功したか (null: 失敗)
   */
  connect4 = async receiveMessage => {
    if (
      receiveMessage.type !== 3 ||
      receiveMessage.to !== this.selfAddress ||
      receiveMessage.from !== this.otherAddress ||
      await this.shortKey.decryptMessageString(receiveMessage.finish) !== "finish"
    ) { return null; }
    this.isConnect = true;
    return true;
  };



  /**
   * 送信する  
   * @method
   * @public
   * @param {string} data 送信するデータ
   * @returns {Promise<?Object>} メッセージ (null: 失敗)
   */
  send = async data => {
    if (!this.isConnect) { return null; }
    const ciphertext = await this.shortKey.encryptMessageString(data);
    return this.createMessage(0, {
      ciphertext,
    });
  };
  /**
   * 受信する  
   * @method
   * @public
   * @param {Object} receiveMessage 受信したメッセージ
   * @returns {Promise<?string>} 受信したデータ (null: 失敗)
   */
  receive = async receiveMessage => {
    if (
      !this.isConnect ||
      receiveMessage.type !== 0 ||
      receiveMessage.to !== this.selfAddress ||
      receiveMessage.from !== this.otherAddress ||
      !receiveMessage.ciphertext
    ) { return null; }
    const prevReceiveResolve = this.receiveResolve;
    receivePromise = new Promise(resolve => this.receiveResolve = resolve);
    prevReceiveResolve();
    return await this.shortKey.decryptMessageString(receiveMessage.ciphertext);
  };
  receiveResolve;
  receivePromise = new Promise(resolve => this.receiveResolve = resolve);
}
export default Channel;
