/**
 * @file レート制限を行うクラス
 * @version 1.0.0
 * @author adyobe
 * @copyright All rights reserved.
 * @license "All rights reserved"
 */

/**
 * レート制限を行うクラス  
 * @class
 */
export class RateLimiter {
  /**
   * 最後に実行した Promise  
   * @member {Promise<void>}
   * @default Promise.resolve()
   * @private
   */
  #lastPromise = Promise.resolve();

  /**
   * 最後に実行したタイムスタンプ  
   * @member {?number}
   * @default -Infinity
   * @private
   */
  #lastTimestamp = -Infinity;

  /**
   * デフォルトの待機時間 (ミリ秒, ms)  
   * @member {number}
   * @default 2000
   * @public
   */
  defaultDelay;

  /**
   * @constructor
   * @param {number} [defaultDelay=2000] デフォルトの待機時間 (ミリ秒, ms)
   * @throws {TypeError} defaultDelay が非負の数値でない場合
   */
  constructor(defaultDelay = 2000) {
    if (typeof defaultDelay !== "number" || defaultDelay < 0) {
      throw new TypeError("defaultDelay must be a non-negative number");
    }
    this.defaultDelay = defaultDelay;
  }

  /**
   * 待機  
   * @method
   * @async
   * @param {number} [delay=this.defaultDelay] 待機時間 (ミリ秒, ms)
   * @returns {Promise<void>} 待機後に解決する Promise
   * @throws {TypeError} delay が数値でない場合
   */
  async task(delay = this.defaultDelay) {
    if (typeof delay !== "number") {
      throw new TypeError("delay must be a number");
    } else if (delay < 0) {
      console.warn("Warning: delay should not be negative. Setting delay to 0.");
      delay = 0;
    }
    if (this.#lastTimestamp !== null) {
      delay -= (Date.now() - this.#lastTimestamp);
      if (delay < 0) { delay = 0; }
      this.#lastTimestamp = null;
    }
    let nextResolve;
    const lastPromise = this.#lastPromise;
    const nextPromise = 0 < delay ? new Promise(r => nextResolve = r) : Promise.resolve();
    this.#lastPromise = nextPromise;
    await lastPromise;
    if (nextResolve) {
      await new Promise(r => setTimeout(r, delay));
      nextResolve();
    }
    if (nextPromise === this.#lastPromise) { this.#lastTimestamp = new Date().getTime(); }
    return;
  }
}
export default RateLimiter;
