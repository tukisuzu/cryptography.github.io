import BufferToBase64 from "./BufferToBase64.js";

/**
 * 短期(一時)鍵となる非対称鍵ペアを生成する  
 * この鍵は、対称鍵を生成するための鍵交換に使用される  
 * 鍵生成アルゴリズム: ECDH, P-521  
 * 鍵交換アルゴリズム: ECDH, AES-GCM, 256bit  
 * 短期鍵から対称鍵を生成する  
 * この鍵は、暗号化と復号に使用される  
 * 暗号化アルゴリズム: AES-GCM, 256bit, 128bit tag, 96bit IV  
 * @class
 * @public
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6090} 楕円曲線暗号について
 * @see {@link https://developer.mozilla.org/ja/docs/Web/API/EcKeyGenParams} ECDH の鍵生成パラメータ
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/EcdhKeyDeriveParams} ECDH の鍵交換パラメータ
 * @see {@link https://github.com/mdn/dom-examples/blob/main/web-crypto/derive-key/ecdh.js} ECDH の例
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams} AES-GCM のパラメータ
 * @see {@link https://github.com/mdn/dom-examples/blob/main/web-crypto/encrypt-decrypt/aes-gcm.js} AES-GCM の例
 * @see {@link https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf} AES-GCM の仕様書, 8.2 IV Constructions, Appendix C: Requirements and Guidelines for Using Short Tags
 * @see {@link https://www.mbsd.jp/research/20200901/aes-gcm/} AES-GCM の日本語解説
 */
class ShortKey {
  /**
   * 鍵ペアを生成する  
   * 使用目的: 鍵交換  
   * アルゴリズム: ECDH, P-521  
   * @method
   * @async
   * @static
   * @public
   * @returns {Promise<CryptoKeyPair>} 鍵ペア
   */
  static generateKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-521" },
      true,
      ["deriveKey"],
    );
    return keyPair;
  };

  /**
   * 鍵をエクスポートする  
   * 秘密鍵のエクスポートは非推奨  
   * @method
   * @async
   * @static
   * @public
   * @param {CryptoKey} key エクスポートする鍵
   * @param {boolean} isPublic 公開鍵か否か
   * @returns {Promise<Uint8Array>} エクスポートされた鍵, 公開鍵の場合は spki 形式 秘密鍵の場合は pkcs8 形式
   */
  static exportKey = async (key, isPublic) => {
    if (!isPublic) { console.warn("Exporting a private key is not recommended."); }
    const keyData = new Uint8Array(await window.crypto.subtle.exportKey(
      isPublic ? "spki" : "pkcs8",
      key,
    ));
    return keyData;
  };
  /**
   * 鍵をインポートする  
   * 秘密鍵のインポートは非推奨  
   * @method
   * @async
   * @static
   * @public
   * @param {Uint8Array} keyData インポートする鍵
   * @param {boolean} isPublic 公開鍵か否か
   * @returns {Promise<CryptoKey>} インポートされた鍵, 公開鍵の場合は 無し 秘密鍵の場合は deriveKey
   */
  static importKey = async (keyData, isPublic) => {
    if (!isPublic) { console.warn("Importing a private key is not recommended."); }
    const key = await window.crypto.subtle.importKey(
      isPublic ? "spki" : "pkcs8",
      keyData,
      { name: "ECDH", namedCurve: "P-521", },
      true,
      isPublic ? [] : ["deriveKey"],
    );
    return key;
  };

  /**
   * 共通鍵を生成する  
   * エクスポート不可  
   * @method
   * @async
   * @static
   * @public
   * @param {CryptoKey} privateKey 自分の秘密鍵
   * @param {CryptoKey} publicKey 相手の公開鍵
   * @returns {Promise<CryptoKey>} 共通鍵
   */
  static deriveKey = async (privateKey, publicKey) => {
    const secretKey = await window.crypto.subtle.deriveKey(
      { name: "ECDH", public: publicKey, },
      privateKey,
      { name: "AES-GCM", length: 256, },
      false, // 共通鍵はエクスポート禁止
      ["encrypt", "decrypt"],
    );
    return secretKey;
  };

  /**
   * 認証タグの長さ  
   * これは、暗号文の認証(改竄検知)に使用される  
   * 128 bit が推奨されている  
   * @member
   * @static
   * @public
   * @type {number}
   * @default 128
   */
  static tagLength = 128;
  /**
   * 初期化ベクトル(IV)の Byte 長  
   * これは、暗号化のランダム性を増すために使用される  
   * 96 bit = 12 Byte が推奨されている  
   * @member
   * @static
   * @public
   * @type {number}
   * @default 12
   */
  static ivLength = 12;
  /**
   * データを暗号化する  
   * @method
   * @async
   * @static
   * @public
   * @param {Uint8Array} data 暗号化するデータ
   * @param {CryptoKey} key 共通鍵
   * @returns {Promise<Uint8Array>} 暗号化されたデータ
   */
  static encrypt = async (data, key) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(this.ivLength));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: this.tagLength, },
      key,
      data,
    );
    const buffer = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    /**
     * IV を先頭に配置する  
     * 復号時に使用される  
     * 毎回ランダムな値が使用されてさえいればいいので、平文のまま送信しても問題ない  
     */
    buffer.set(iv, 0);
    buffer.set(new Uint8Array(ciphertext), iv.byteLength);
    return buffer;
  };
  /**
   * データを復号する  
   * @method
   * @async
   * @static
   * @public
   * @param {Uint8Array} data 復号するデータ
   * @param {CryptoKey} key 共通鍵
   * @returns {Promise<?Uint8Array>} 復号されたデータ, 復号に失敗した場合は null
   */
  static decrypt = async (data, key) => {
    try {
      const iv = new Uint8Array(data.subarray(0, this.ivLength));
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: this.tagLength, },
        key,
        data.subarray(iv.byteLength),
      );
      return new Uint8Array(decrypted);
    } catch (error) {
      console.warn(error);
      return null;
    }
  };



  /**
   * 自分の公開鍵  
   * @member
   * @public
   * @type {CryptoKey|undefined} 自分の公開鍵
   */
  publicKey;
  /**
   * 自分の秘密鍵  
   * @member
   * @public
   * @type {CryptoKey|undefined} 自分の秘密鍵
   */
  privateKey;
  /**
   * 相手の公開鍵  
   * @member
   * @public
   * @type {CryptoKey|undefined} 相手の公開鍵
   */
  otherPublicKey;
  /**
   * 共通鍵  
   * @member
   * @public
   * @type {CryptoKey|undefined} 共通鍵
   */
  secretKey;

  /**
   * コンストラクタ  
   * @constructor
   * @public
   * @param {Object} options オプション
   * @param {Uint8Array|string|undefined} options.otherPublicKeyData 相手の公開鍵
   * @returns {this}
   */
  constructor({
    otherPublicKeyData,
  } = {}) {
    if (otherPublicKeyData) { this.importOtherPublicKey(otherPublicKeyData); }
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
      publicKey: this.publicKey,
      privateKey: this.privateKey,
    } = await this.constructor.generateKeyPair());
    this.otherPublicKeyData = undefined;
    this.secretKey = undefined;
    return this;
  };


  /**
   * 公開鍵をインポートする  
   * 秘密鍵のインポートが非推奨なため、公開鍵のみのインポートは無意味  
   * @deprecated
   * @method
   * @async
   * @public
   * @param {Uint8Array|string} keyData インポートする公開鍵
   * @returns {Promise<boolean>} インポート結果
   */
  importPublicKey = async keyData => {
    try {
      if (keyData instanceof Uint8Array) {
        this.publicKey = await this.constructor.importKey(keyData, true);
      } else if (typeof keyData === "string") {
        this.publicKey = await this.constructor.importKey(BufferToBase64.decode(keyData), true);
      } else {
        throw new TypeError("Invalid data type.");
      }
      return true;
    } catch (error) {
      console.warn(error);
      this.publicKey = undefined;
      return false;
    }
  };
  /**
   * 秘密鍵をインポートする  
   * 秘密鍵のインポートは非推奨  
   * @deprecated
   * @method
   * @async
   * @public
   * @param {Uint8Array|string} keyData インポートする秘密鍵
   * @returns {Promise<boolean>} インポート結果
   */
  importPrivateKey = async keyData => {
    try {
      if (keyData instanceof Uint8Array) {
        this.privateKey = await this.constructor.importKey(keyData, false);
      } else if (typeof keyData === "string") {
        this.privateKey = await this.constructor.importKey(BufferToBase64.decode(keyData), false);
      } else {
        throw new TypeError("Invalid data type.");
      }
      return true;
    } catch (error) {
      console.warn(error);
      this.privateKey = undefined;
      return false;
    }
  };
  /**
   * 相手の公開鍵をインポートする  
   * @method
   * @async
   * @public
   * @param {Uint8Array|string} keyData インポートする公開鍵
   * @returns {Promise<boolean>} インポート結果
   */
  importOtherPublicKey = async keyData => {
    try {
      if (keyData instanceof Uint8Array) {
        this.otherPublicKey = await this.constructor.importKey(keyData, true);
      } else if (typeof keyData === "string") {
        this.otherPublicKey = await this.constructor.importKey(BufferToBase64.decode(keyData), true);
      } else {
        throw new TypeError("Invalid data type.");
      }
      return true;
    } catch (error) {
      console.warn(error);
      this.otherPublicKey = undefined;
      return false;
    }
  };


  /**
   * 公開鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<Uint8Array>} エクスポートされた公開鍵
   */
  exportPublicKey = async () => await this.constructor.exportKey(this.publicKey, true);
  /**
   * 秘密鍵をエクスポートする  
   * 秘密鍵のエクスポートは非推奨  
   * @deprecated
   * @method
   * @async
   * @public
   * @returns {Promise<Uint8Array>} エクスポートされた秘密鍵
   */
  exportPrivateKey = async () => await this.constructor.exportKey(this.privateKey, false);
  /**
   * 相手の公開鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<Uint8Array>} エクスポートされた公開鍵
   */
  exportOtherPublicKey = async () => await this.constructor.exportKey(this.otherPublicKey, true);

  /**
   * 公開鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<string>} エクスポートされた公開鍵
   */
  exportPublicKeyString = async () => BufferToBase64.encode(await this.exportPublicKey());
  /**
   * 秘密鍵をエクスポートする  
   * 秘密鍵のエクスポートは非推奨  
   * @deprecated
   * @method
   * @async
   * @public
   * @returns {Promise<string>} エクスポートされた秘密鍵
   */
  exportPrivateKeyString = async () => BufferToBase64.encode(await this.exportPrivateKey());
  /**
   * 相手の公開鍵をエクスポートする  
   * @method
   * @async
   * @public
   * @returns {Promise<string>} エクスポートされた公開鍵
   */
  exportOtherPublicKeyString = async () => BufferToBase64.encode(await this.exportOtherPublicKey());


  /**
   * 共通鍵を生成する  
   * @method
   * @async
   * @public
   * @returns {Promise<boolean>} 生成結果
   */
  deriveKey = async () => {
    try {
      if (!this.otherPublicKey) { throw new Error("The other public key is not imported."); }
      this.secretKey = await this.constructor.deriveKey(this.privateKey, this.otherPublicKey);
      return true;
    } catch (error) {
      console.warn(error);
      this.secretKey = undefined;
      return false;
    }
  };


  /**
   * データを暗号化する  
   * @method
   * @async
   * @public
   * @param {Uint8Array} data 暗号化するデータ
   * @returns {Promise<Uint8Array>} 暗号化されたデータ
   */
  encryptData = async data => await this.constructor.encrypt(data, this.secretKey);
  /**
   * データを復号する  
   * @method
   * @async
   * @public
   * @param {Uint8Array} data 復号するデータ
   * @returns {Promise<Uint8Array>} 復号されたデータ
   */
  decryptData = async data => await this.constructor.decrypt(data, this.secretKey);

  /**
   * データを暗号化する  
   * @method
   * @async
   * @public
   * @param {Uint8Array} data 暗号化するデータ
   * @returns {Promise<string>} 暗号化されたデータ
   */
  encryptDataString = async data => BufferToBase64.encode(await this.encryptData(data));
  /**
   * データを復号する  
   * @method
   * @async
   * @public
   * @param {string} data 復号するデータ
   * @returns {Promise<Uint8Array>} 復号されたデータ
   */
  decryptDataString = async data => await this.decryptData(BufferToBase64.decode(data));

  /**
   * メッセージを暗号化する  
   * @method
   * @async
   * @public
   * @param {string} message 暗号化するメッセージ
   * @returns {Promise<Uint8Array>} 暗号化されたメッセージ
   */
  encryptMessage = async message => await this.encryptData(new TextEncoder().encode(message));
  /**
   * メッセージを復号する  
   * @method
   * @async
   * @public
   * @param {Uint8Array} message 復号するメッセージ
   * @returns {Promise<string>} 復号されたメッセージ
   */
  decryptMessage = async message => { const plaintext = await this.decryptData(message); return plaintext ? new TextDecoder().decode(plaintext) : plaintext; };

  /**
   * メッセージを暗号化する  
   * @method
   * @async
   * @public
   * @param {string} message 暗号化するメッセージ
   * @returns {Promise<string>} 暗号化されたメッセージ
   */
  encryptMessageString = async message => BufferToBase64.encode(await this.encryptMessage(message));
  /**
   * メッセージを復号する  
   * @method
   * @async
   * @public
   * @param {string} message 復号するメッセージ
   * @returns {Promise<string>} 復号されたメッセージ
   */
  decryptMessageString = async message => await this.decryptMessage(BufferToBase64.decode(message));
}
export default ShortKey;
