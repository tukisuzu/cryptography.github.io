/**
 * Buffer to Base64 String  
 * @class
 * @public
 */
export class BufferToBase64 {
  /**
   * TextEncoder  
   * @member
   * @static
   * @public
   * @type {TextEncoder} textEncoder A text encoder.
   */
  static textEncoder = new TextEncoder("ascii");
  /**
   * TextDecoder  
   * @member
   * @static
   * @public
   * @type {TextDecoder} textDecoder A text decoder.
   */
  static textDecoder = new TextDecoder("ascii");

  /**
   * Convert an integer to a Base64 character (ascii)  
   * ascii: 0-9: 48-57, A-Z: 65-90, a-z: 97-122, -: 45, _: 95  
   * index: 0-9: 0-9, 10-35: A-Z, 36-61: a-z, 62: -, 63: _  
   * @method
   * @static
   * @public
   * @param {number} i An integer to convert.
   * @returns {number} A Base64 character (ascii).
   */
  static itoa = i => i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i === 62 ? 45 : 95;
  /**
   * Convert a Base64 character (ascii) to an integer  
   * ascii: 0-9: 48-57, A-Z: 65-90, a-z: 97-122, -: 45, _: 95  
   * index: 0-9: 0-9, 10-35: A-Z, 36-61: a-z, 62: -, 63: _  
   * @method
   * @static
   * @public
   * @param {number} a A Base64 character (ascii) to convert.
   * @returns {number} An integer.
   */
  static atoi = a => 96 < a ? a - 71 : a === 95 ? 63 : 64 < a ? a - 65 : 47 < a ? a + 4 : 62;

  /**
   * Encode a Uint8Array to a Base64 string  
   * @method
   * @static
   * @public
   * @param {Uint8Array} inputData An input data.
   * @returns {string} An output data.
   */
  static encode = (inputData = new Uint8Array()) => {
    const padding = inputData.byteLength % 3;
    const inputLength = inputData.byteLength - padding;
    const outputLength = inputLength / 3 * 4 + (padding > 0 ? padding + 1 : 0);
    const outputData = new Uint8Array(outputLength);
    let outputIndex = 0;
    for (let i = 0; i < inputLength;) {
      const buffer = (inputData[i++] << 16) | (inputData[i++] << 8) | inputData[i++];
      outputData[outputIndex++] = this.itoa(buffer >> 18);
      outputData[outputIndex++] = this.itoa((buffer >> 12) & 0x3f);
      outputData[outputIndex++] = this.itoa((buffer >> 6) & 0x3f);
      outputData[outputIndex++] = this.itoa(buffer & 0x3f);
    }
    if (padding === 1) {
      const buffer = inputData[inputLength];
      outputData[outputIndex++] = this.itoa(buffer >> 2);
      outputData[outputIndex++] = this.itoa((buffer << 4) & 0x3f);
    } else if (padding === 2) {
      const buffer = (inputData[inputLength] << 8) | inputData[inputLength + 1];
      outputData[outputIndex++] = this.itoa(buffer >> 10);
      outputData[outputIndex++] = this.itoa((buffer >> 4) & 0x3f);
      outputData[outputIndex++] = this.itoa((buffer << 2) & 0x3f);
    }
    return this.textDecoder.decode(outputData);
  };
  /**
   * Decode a Base64 string to a Uint8Array  
   * @method
   * @static
   * @public
   * @param {string} inputData An input data.
   * @returns {Uint8Array} An output data.
   */
  static decode = (inputData = "") => {
    inputData = this.textEncoder.encode(inputData);
    const padding = inputData.byteLength % 4;
    const inputLength = inputData.byteLength - padding;
    const outputLength = inputLength / 4 * 3 + (padding > 0 ? padding - 1 : 0)
    const outputData = new Uint8Array(outputLength);
    let outputIndex = 0;
    for (let i = 0; i < inputLength;) {
      const buffer = (this.atoi(inputData[i++]) << 18) | (this.atoi(inputData[i++]) << 12) | (this.atoi(inputData[i++]) << 6) | this.atoi(inputData[i++]);
      outputData[outputIndex++] = buffer >> 16;
      outputData[outputIndex++] = (buffer >> 8) & 0xff;
      outputData[outputIndex++] = buffer & 0xff;
    }
    if (padding === 2) {
      const buffer = (this.atoi(inputData[inputLength]) << 2) | (this.atoi(inputData[inputLength + 1]) >> 4);
      outputData[outputIndex++] = buffer;
    } else if (padding === 3) {
      const buffer = (this.atoi(inputData[inputLength]) << 10) | (this.atoi(inputData[inputLength + 1]) << 4) | (this.atoi(inputData[inputLength + 2]) >> 2);
      outputData[outputIndex++] = buffer >> 8;
      outputData[outputIndex++] = buffer & 0xff;
    }
    return outputData;
  };
}
export default BufferToBase64;
