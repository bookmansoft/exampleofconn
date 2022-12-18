/**
 * 定义了一个独立数据校验函数，用于游戏服务端在登录、支付时的独立验证
 */
const assert = require('assert');
const secp256k1 = require('./secp256k1');
const utils = require('./utils')

const networks = {prefix:[
  {type: 'main' , bech32: 'bc' }, 
  {type: 'testnet', bech32 : 'tb' }, 
  {type: 'regtest', bech32 : 'rb' }, 
  {type: 'simnet', bech32 : 'sc'}
]};

/**
 * 生成私钥/公钥对
 * @param {String} priv 
 * @returns {Object} {private, public}
 */
function generateKey(priv) {
  if(!priv){
    //生成一个私钥
    priv = secp256k1.generatePrivateKey();
  }

  if(typeof priv == 'string') {
    priv = Buffer.from(priv, 'hex');
  }
  
  //预生成配套公钥
  let pub = secp256k1.publicKeyCreate(priv, true);

  return {
    private: priv.toString('hex'),
    public: pub.toString('hex'),
  }
}

/**
 * 针对输入消息，用私钥生成并返回一个签名
 * @param {String}  msg   待签名的消息，字符串格式
 * @param {String}  pri   签名私钥，HEX字符串格式
 * @returns {String} 签名字符串
 */

function signObj(msg, pri) {
  msg = utils.hash256(Buffer.from(utils.stringify(msg)));

  if(typeof pri == 'string') {
    pri = Buffer.from(pri, 'hex');
  }

  let sig = secp256k1.sign(msg, pri);
  return sig.toString('hex');
};

/**
 * 针对输入消息和签名字段，用公钥验证签名
 * @param {String}  msg 带签名的消息，字符串格式
 * @param {String}  sig 签名字段，JSON字符串格式
 * @param {String}  pub 验证签名的公钥，HEX字符串格式
 * @returns {Boolean} 验证是否通过
 */

function verifyObj(msg, sig, pub) {
  msg = utils.hash256(Buffer.from(utils.stringify(msg)));

  if(typeof sig == 'string') {
    sig = Buffer.from(sig, 'hex');
  }
  if(typeof pub == 'string') {
    pub = Buffer.from(pub, 'hex');
  }

  return secp256k1.verify(msg, sig, pub);
};

/**
 * 签发令牌
 * 
 * @note 
 *  1、对 data 进行签名，并添加 pubkey addr 等附加字段
 *  2、如果该令牌能通过 verifyData 函数的校验，则证明令牌持有者拥有对 addr 地址的支配权
 *  3、本算法的签名/验签相互独立，且没有事先在双方间建立默契，因此不能保证数据传输中不被篡改，只能说明数据是 addr 地址的支配者发出
 *  4、本算法对外暴露了地址的公钥，对地址安全性有一定的影响 
 * 
 * @param {Object} data   
 * @param {Object} options 
 */
function signData(data, options) {
  data = data || {};
  if(!data.cid) {
    data.cid = options.cid;
  }

  if(!!data.time) { //如果time字段传入true，则添加时间戳
    data.time = (now() / 300) | 0; //当前时间戳的分钟形式，确保随机量定期自动变化
  }

  //#region 添加核心字段
  //为数据对象添加 bench32 格式的地址。该字段参与签名以防止篡改
  data.addr = options.alice_add;
  //为数据对象添加公钥，用于后续的数据校验。该字段参与签名以防止篡改
  data.pubkey = options.alice_pub;
  //#endregion

  let ret = {
      data: data,
  }
  
  //将数据对象规整为32字节哈希
  let hash = utils.hash256(Buffer.from(utils.stringify(ret.data)));

  //用私钥对规整数据进行签名, 将签名以HEX字符串形式存储
  ret.sig = secp256k1.sign(hash, Buffer.from(options.alice_prv, 'hex')).toString('hex');

  //返回包含签名信息的数据对象
  return ret;
}

/**
 * 验证持令牌者，拥有对令牌中地址的支配权
 * @param {Object} packet 
 *      {
 *          data:               //等待校验的数据
 *          {
 *              pubkey,         //用于签名校验的公钥
 *              ...             //其他字段
 *          }, 
 *          sig                 //数据的签名
 *      }
 */
function verifyData(packet) {
    try {
        //取出公钥
        let key = Buffer.from(packet.data.pubkey, 'hex'); 

        //取待校验数据，注意序列化时使用了属性名自然排序，因此要求签名时也必须使用属性名自然排序
        let src = Buffer.from(utils.stringify(packet.data));

        //利用公钥校验数据
        if(secp256k1.verify(
            utils.hash256(src),                //将待校验的数据对象规整为32字节哈希
            Buffer.from(packet.sig, 'hex'),     //取签名信息
            key,                                //公钥
        )) {
            //至此，证明了数据签名确实是使用和公钥匹配的私钥加密而来的
            if(decode(packet.data.addr).hash.toString('hex') == utils.hash160(key).toString('hex')) {
                //至此，证明了数据中的地址和公钥是匹配的，持此令牌的用户对该地址拥有支配权
                return true;  //校验成功
            }
        }
    } catch (e) {

    }

    return false;
}

/**
 * 验证持地址是否是合法的--仅验证bech32
 * @param {String} addr 地址
 * @param {String} networkType 地址网络类型 
 */
function verifyAddress(addr,networkType) {
  try {
    //验证传入的地址类型    
    assert(typeof(addr) === 'string');    
    assert(addr.length > 0);
    assert(addr.length <= 100);
    // 默认为testnet
    if(!networkType){
      networkType = "testnet";
    }
    // 使用bech32解码
    const verifiedAddr = decode(addr);    
    // 验证地址前缀
    let verifiddPrefix = false;
    for (const prefix of networks.prefix) {     
      if (prefix.type === networkType && prefix.bech32 === verifiedAddr.hrp){
        verifiddPrefix = true;
        break;
      }
    }
    if(!verifiddPrefix)
      throw new Error(`Network not found for ${verifiedAddr.hrp}.`);
  
    //验证地址构成
    let hash = verifiedAddr.hash;
    if (typeof(verifiedAddr.hash) === 'string'){
      hash = Buffer.from(verifiedAddr.hash, 'hex'); 
    }
    assert(Buffer.isBuffer(hash));
    // version === 0 && type === Address.types.WITNESS
    assert(hash.length === 20 || hash.length === 32,
      'Witness program hash is the wrong size.');       
    assert(hash.length >= 2 && hash.length <= 40, 'Hash is the wrong size.');
    
    return {
      result: true,
    }
  } catch (e) {
    return {
      result: false,
      error: {
        type: e.type || 'Error',
        message: e.message,
        code: e.code
      }
    }
  }
}

const POOL65 = Buffer.allocUnsafe(65);
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const TABLE = [
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  15, -1, 10, 17, 21, 20, 26, 30,  7,  5, -1, -1, -1, -1, -1, -1,
  -1, 29, -1, 24, 13, 25,  9,  8, 23, -1, 18, 22, 31, 27, 19, -1,
   1,  0,  3, 16, 11, 28, 12, 14,  6,  4,  2, -1, -1, -1, -1, -1,
  -1, 29, -1, 24, 13, 25,  9,  8, 23, -1, 18, 22, 31, 27, 19, -1,
   1,  0,  3, 16, 11, 28, 12, 14,  6,  4,  2, -1, -1, -1, -1, -1
];

/**
 * Update checksum.
 * @ignore
 * @param {Number} chk
 * @returns {Number}
 */

function polymod(pre) {
  const b = pre >>> 25;
  return ((pre & 0x1ffffff) << 5)
    ^ (-((b >> 0) & 1) & 0x3b6a57b2)
    ^ (-((b >> 1) & 1) & 0x26508e6d)
    ^ (-((b >> 2) & 1) & 0x1ea119fa)
    ^ (-((b >> 3) & 1) & 0x3d4233dd)
    ^ (-((b >> 4) & 1) & 0x2a1462b3);
}

/**
 * Encode hrp and data as a bech32 string.
 * @ignore
 * @param {String} hrp
 * @param {Buffer} data
 * @returns {String}
 */

function serialize(hrp, data) {
  let chk = 1;
  let i;

  for (i = 0; i < hrp.length; i++) {
    const ch = hrp.charCodeAt(i);

    if ((ch >> 5) === 0)
      throw new Error('Invalid bech32 character.');

    chk = polymod(chk) ^ (ch >> 5);
  }

  if (i + 7 + data.length > 90)
    throw new Error('Invalid bech32 data length.');

  chk = polymod(chk);

  let str = '';

  for (let i = 0; i < hrp.length; i++) {
    const ch = hrp.charCodeAt(i);
    chk = polymod(chk) ^ (ch & 0x1f);
    str += hrp[i];
  }

  str += '1';

  for (let i = 0; i < data.length; i++) {
    const ch = data[i];

    if ((ch >> 5) !== 0)
      throw new Error('Invalid bech32 value.');

    chk = polymod(chk) ^ ch;
    str += CHARSET[ch];
  }

  for (let i = 0; i < 6; i++)
    chk = polymod(chk);

  chk ^= 1;

  for (let i = 0; i < 6; i++)
    str += CHARSET[(chk >>> ((5 - i) * 5)) & 0x1f];

  return str;
}

/**
 * Decode a bech32 string.
 * @param {String} str
 * @returns {Array} [hrp, data]
 */

function deserialize(str) {
  let dlen = 0;

  if (str.length < 8 || str.length > 90)
    throw new Error('Invalid bech32 string length.');

  while (dlen < str.length && str[(str.length - 1) - dlen] !== '1')
    dlen++;

  const hlen = str.length - (1 + dlen);

  if (hlen < 1 || dlen < 6)
    throw new Error('Invalid bech32 data length.');

  dlen -= 6;

  const data = Buffer.allocUnsafe(dlen);

  let chk = 1;
  let lower = false;
  let upper = false;
  let hrp = '';

  for (let i = 0; i < hlen; i++) {
    let ch = str.charCodeAt(i);

    if (ch < 0x21 || ch > 0x7e)
      throw new Error('Invalid bech32 character.');

    if (ch >= 0x61 && ch <= 0x7a) {
      lower = true;
    } else if (ch >= 0x41 && ch <= 0x5a) {
      upper = true;
      ch = (ch - 0x41) + 0x61;
    }

    hrp += String.fromCharCode(ch);
    chk = polymod(chk) ^ (ch >> 5);
  }

  chk = polymod(chk);

  let i;
  for (i = 0; i < hlen; i++)
    chk = polymod(chk) ^ (str.charCodeAt(i) & 0x1f);

  i++;

  while (i < str.length) {
    const ch = str.charCodeAt(i);
    const v = (ch & 0x80) ? -1 : TABLE[ch];

    if (ch >= 0x61 && ch <= 0x7a)
      lower = true;
    else if (ch >= 0x41 && ch <= 0x5a)
      upper = true;

    if (v === -1)
      throw new Error('Invalid bech32 character.');

    chk = polymod(chk) ^ v;

    if (i + 6 < str.length)
      data[i - (1 + hlen)] = v;

    i++;
  }

  if (lower && upper)
    throw new Error('Invalid bech32 casing.');

  if (chk !== 1)
    throw new Error('Invalid bech32 checksum.');

  return [hrp, data.slice(0, dlen)];
}

/**
 * Convert serialized data to bits,
 * suitable to be serialized as bech32.
 * @param {Buffer} data
 * @param {Buffer} output
 * @param {Number} frombits
 * @param {Number} tobits
 * @param {Number} pad
 * @param {Number} off
 * @returns {Buffer}
 */

function convert(data, output, frombits, tobits, pad, off) {
  const maxv = (1 << tobits) - 1;
  let acc = 0;
  let bits = 0;
  let j = 0;

  if (pad !== -1)
    output[j++] = pad;

  for (let i = off; i < data.length; i++) {
    const value = data[i];

    if ((value >> frombits) !== 0)
      throw new Error('Invalid bech32 bits.');

    acc = (acc << frombits) | value;
    bits += frombits;

    while (bits >= tobits) {
      bits -= tobits;
      output[j++] = (acc >>> bits) & maxv;
    }
  }

  if (pad !== -1) {
    if (bits > 0)
      output[j++] = (acc << (tobits - bits)) & maxv;
  } else {
    if (bits >= frombits || ((acc << (tobits - bits)) & maxv))
      throw new Error('Invalid bech32 bits.');
  }

  return output.slice(0, j);
}

/**
 * Serialize data to bech32 address.
 * @param {String} hrp
 * @param {Number} version
 * @param {Buffer} hash
 * @returns {String}
 */

function encode(hrp, version, hash) {
  const output = POOL65;

  if (version < 0 || version > 16)
    throw new Error('Invalid bech32 version.');

  if (hash.length < 2 || hash.length > 40)
    throw new Error('Invalid bech32 data length.');

  const data = convert(hash, output, 8, 5, version, 0);

  return serialize(hrp, data);
}

/**
 * Deserialize data from bech32 address.
 * @param {String} str
 * @returns {Object}
 */

function decode(str) {
  const [hrp, data] = deserialize(str);

  if (data.length === 0 || data.length > 65)
    throw new Error('Invalid bech32 data length.');

  if (data[0] > 16)
    throw new Error('Invalid bech32 version.');

  const version = data[0];
  const output = data;
  const hash = convert(data, output, 5, 8, -1, 1);

  if (hash.length < 2 || hash.length > 40)
    throw new Error('Invalid bech32 data length.');

  return new AddrResult(hrp, version, hash);
}

/**
 * AddrResult
 * @constructor
 * @private
 * @param {String} hrp
 * @param {Number} version
 * @param {Buffer} hash
 * @property {String} hrp
 * @property {Number} version
 * @property {Buffer} hash
 */

function AddrResult(hrp, version, hash) {
  this.hrp = hrp;
  this.version = version;
  this.hash = hash;
}

/*
 * Expose
 */

module.exports.generateKey = generateKey;
module.exports.verifyAddress = verifyAddress;
module.exports.signObj = signObj;
module.exports.verifyObj = verifyObj;
module.exports.signData = signData;
module.exports.verifyData = verifyData;
