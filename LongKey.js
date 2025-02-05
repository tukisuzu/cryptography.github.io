import BufferToBase64 from "./BufferToBase64.js";

/**
 * 長期(固定)鍵となる非対称鍵ペアを生成する  
 * この鍵は、電子署名の生成と検証に使用される  
 * 鍵生成アルゴリズム: ECDSA, P-521  
 * 署名アルゴリズム: ECDSA, SHA-512  
 * 秘密鍵を他人に知られてはいけない  
 * @class
 * @public
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6090} 楕円曲線暗号について
 * @see {@link https://developer.mozilla.org/ja/docs/Web/API/EcKeyGenParams} ECDSA の鍵生成パラメータ
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/EcdsaParams} ECDSA の署名パラメータ
 * @see {@link https://github.com/mdn/dom-examples/blob/main/web-crypto/sign-verify/ecdsa.js} ECDSA の例
 * @see {@link https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-5.pdf} 連邦情報処理標準, 6. The Elliptic Curve Digital Signature Algorithm (ECDSA)
 */
export class LongKey {
  /**
   * 鍵ペアを生成する  
   * 使用目的: 署名, 検証  
   * アルゴリズム: ECDSA, P-521  
   * @method
   * @async
   * @static
   * @public
   * @returns {Promise<CryptoKeyPair>} 鍵ペア
   */
  static generateKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-521" },
      true,
      ["sign", "verify"],
    );
    return keyPair;
  };

  /**
   * 鍵をエクスポートする  
   * @method
   * @async
   * @static
   * @public
   * @param {CryptoKey} key エクスポートする鍵
   * @param {boolean} isPublic 公開鍵か否か
   * @returns {Promise<Uint8Array>} エクスポートされた鍵, 公開鍵の場合は spki 形式 秘密鍵の場合は pkcs8 形式
   */
  static exportKey = async (key, isPublic) => {
    const keyData = new Uint8Array(await window.crypto.subtle.exportKey(
      isPublic ? "spki" : "pkcs8",
      key,
    ));
    return keyData;
  };
  /**
   * 鍵をインポートする  
   * @method
   * @async
   * @static
   * @public
   * @param {Uint8Array} keyData インポートする鍵
   * @param {boolean} isPublic 公開鍵か否か
   * @returns {Promise<CryptoKey>} インポートされた鍵, 公開鍵の場合は verify 秘密鍵の場合は sign
   */
  static importKey = async (keyData, isPublic) => {
    const key = await window.crypto.subtle.importKey(
      isPublic ? "spki" : "pkcs8",
      keyData,
      { name: "ECDSA", namedCurve: "P-521", },
      true,
      isPublic ? ["verify"] : ["sign"],
    );
    return key;
  };

  /**
   * データに署名する  
   * @method
   * @async
   * @static
   * @public
   * @param {Uint8Array} data データ
   * @param {CryptoKey} privateKey 秘密鍵
   * @returns {Promise<Uint8Array>} 署名
   */
  static signData = async (data, privateKey) => {
    const signature = new Uint8Array(await window.crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-512" } },
      privateKey,
      data,
    ));
    return signature;
  };
  /**
   * データの署名を検証する  
   * @method
   * @async
   * @static
   * @public
   * @param {Uint8Array} data データ
   * @param {Uint8Array} signature 署名
   * @param {CryptoKey} publicKey 公開鍵
   * @returns {Promise<boolean>} 検証結果
   */
  static verifyData = async (data, signature, publicKey) => {
    const result = await window.crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-512" } },
      publicKey,
      signature,
      data,
    );
    return result;
  };



  /**
   * 署名用公開鍵(署名には使用しない)  
   * @member
   * @public
   * @type {CryptoKey|undefined} 署名用公開鍵
   */
  signPublicKey;
  /**
   * 署名用秘密鍵  
   * @member
   * @public
   * @type {CryptoKey|undefined} 署名用秘密鍵
   */
  signPrivateKey;
  /**
   * 検証用公開鍵  
   * @member
   * @public
   * @type {CryptoKey|undefined} 検証用公開鍵
   */
  verifyPublicKey;

  /**
   * コンストラクタ  
   * @constructor
   * @public
   * @param {Object} options オプション
   * @param {Uint8Array|string|undefined} options.signPublicKeyData 署名用公開鍵
   * @param {Uint8Array|string|undefined} options.signPrivateKeyData 署名用秘密鍵
   * @param {Uint8Array|string|undefined} options.verifyPublicKeyData 検証用公開鍵
   * @returns {this}
   */
  constructor({
    signPublicKeyData,
    signPrivateKeyData,
    verifyPublicKeyData,
  } = {}) {
    if (signPublicKeyData) { this.importSignPublicKey(signPublicKeyData); }
    if (signPrivateKeyData) { this.importSignPrivateKey(signPrivateKeyData); }
    if (verifyPublicKeyData) { this.importVerifyPublicKey(verifyPublicKeyData); }
  }

  /**
   * 初期化する  
   * @method
   * @async
   * @public
   * @returns {Promise<this>}
   */
  initialize = async () => {
    ({
      publicKey: this.signPublicKey,
      privateKey: this.signPrivateKey,
    } = await this.constructor.generateKeyPair());
    this.verifyPublicKey = undefined;
    return this;
  };


  /**
   * 署名用公開鍵をインポートする  
   * @method
   * @async
   * @public
   * @param {Uint8Array|string} keyData インポートする公開鍵
   * @returns {Promise<boolean>} インポート結果
   */
  importSignPublicKey = async keyData => {
    try {
      if (keyData instanceof Uint8Array) {
        this.signPublicKey = await this.constructor.importKey(keyData, true);
      } else if (typeof keyData === "string") {
        this.signPublicKey = await this.constructor.importKey(BufferToBase64.decode(keyData), true);
      } else {
        throw new TypeError("Invalid data type.");
      }
      return true;
    } catch (error) {
      console.warn(error);
      this.signPublicKey = undefined;
      return false;
    }
  };
  /**
   * 署名用秘密鍵をインポートする  
   * @method
   * @async
   * @public
   * @param {Uint8Array|string} keyData インポートする秘密鍵
   * @returns {Promise<boolean>} インポート結果
   */
  importSignPrivateKey = async keyData => {
    try {
      if (keyData instanceof Uint8Array) {
        this.signPrivateKey = await this.constructor.importKey(keyData, false);
      } else if (typeof keyData === "string") {
        this.signPrivateKey = await this.constructor.importKey(BufferToBase64.decode(keyData), false);
      } else {
        throw new TypeError("Invalid data type.");
      }
      return true;
    } catch (error) {
      console.warn(error);
      this.signPrivateKey = undefined;
      return false;
    }
  };
  /**
   * 検証用公開鍵をインポートする  
   * @method
   * @async
   * @public
   * @param {Uint8Array|string} keyData インポートする公開鍵
   * @returns {Promise<boolean>} インポート結果
   */
  importVerifyPublicKey = async keyData => {
    try {
      if (keyData instanceof Uint8Array) {
        this.verifyPublicKey = await this.constructor.importKey(keyData, true);
      } else if (typeof keyData === "string") {
        this.verifyPublicKey = await this.constructor.importKey(BufferToBase64.decode(keyData), true);
      } else {
        throw new TypeError("Invalid data type.");
      }
      return true;
    } catch (error) {
      console.warn(error);
      this.verifyPublicKey = undefined;
      return false;
    }
  };


  /**
   * 署名用公開鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<Uint8Array>} エクスポートされた公開鍵
   */
  exportSignPublicKey = async () => await this.constructor.exportKey(this.signPublicKey, true);
  /**
   * 署名用秘密鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<Uint8Array>} エクスポートされた秘密鍵
   */
  exportSignPrivateKey = async () => await this.constructor.exportKey(this.signPrivateKey, false);
  /**
   * 検証用公開鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<Uint8Array>} エクスポートされた公開鍵
   */
  exportVerifyPublicKey = async () => await this.constructor.exportKey(this.verifyPublicKey, true);

  /**
   * 署名用公開鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<string>} エクスポートされた公開鍵
   */
  exportSignPublicKeyString = async () => BufferToBase64.encode(await this.exportSignPublicKey());
  /**
   * 署名用秘密鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<string>} エクスポートされた秘密鍵
   */
  exportSignPrivateKeyString = async () => BufferToBase64.encode(await this.exportSignPrivateKey());
  /**
   * 検証用公開鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<string>} エクスポートされた公開鍵
   */
  exportVerifyPublicKeyString = async () => BufferToBase64.encode(await this.exportVerifyPublicKey());


  /**
   * データに署名する  
   * @method
   * @async
   * @public
   * @param {string} data データ
   * @returns {Promise<Uint8Array>} 署名
   */
  signData = async data => await this.constructor.signData(data, this.signPrivateKey);
  /**
   * データの署名を検証する  
   * @method
   * @async
   * @public
   * @param {string} data データ
   * @param {Uint8Array} signature 署名
   * @returns {Promise<boolean>} 検証結果
   */
  verifyData = async (data, signature) => await this.constructor.verifyData(data, signature, this.verifyPublicKey);

  /**
   * データに署名する  
   * @method
   * @async
   * @public
   * @param {string} data データ
   * @returns {Promise<string>} 署名
   */
  signDataString = async data => BufferToBase64.encode(await this.signData(data));
  /**
   * データの署名を検証する  
   * @method
   * @async
   * @public
   * @param {string} data データ
   * @param {string} signature 署名
   */
  verifyDataString = async (data, signature) => await this.verifyData(data, BufferToBase64.decode(signature));


  /**
   * メッセージに署名する  
   * @method
   * @async
   * @public
   * @param {string} message メッセージ
   * @returns {Promise<Uint8Array>} 署名
   */
  signMessage = async message => await this.signData(new TextEncoder().encode(message));
  /**
   * メッセージの署名を検証する  
   * @method
   * @async
   * @public
   * @param {string} message メッセージ
   * @param {Uint8Array} signature 署名
   * @returns {Promise<boolean>} 検証結果
   */
  verifyMessage = async (message, signature) => await this.verifyData(new TextEncoder().encode(message), signature);

  /**
   * メッセージに署名する  
   * @method
   * @async
   * @public
   * @param {string} message メッセージ
   * @returns {Promise<string>} 署名
   */
  signMessageString = async message => BufferToBase64.encode(await this.signMessage(message));
  /**
   * メッセージの署名を検証する  
   * @method
   * @async
   * @public
   * @param {string} message メッセージ
   * @param {string} signature 署名
   * @returns {Promise<boolean>} 検証結果
   */
  verifyMessageString = async (message, signature) => await this.verifyMessage(message, BufferToBase64.decode(signature));
}
export default LongKey;
