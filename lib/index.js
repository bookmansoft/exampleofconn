const fetch = require('node-fetch');    //http函数库
const crypto = require('crypto');       //加密依赖库
const secp256k1 = require('secp256k1'); //椭圆曲线库

/**
 * RPC调用类
 */
class VALLNET
{
  /**
   * 构造函数
   * @param {*} config.url       远程主机地址 
   * @param {*} config.password  远程主机访问密码
   * @param {*} config.id        终端编码
   * @param {*} config.token     终端令牌
   * @param {*} config.printlog  屏显调试信息
   */
  constructor(config) {
    this.url = config.url;
    this.password = config.password;
    this.id = config.id;
    this.token = config.token;
    this.printlog = config.printlog;
  }

  /**
   * 远程调用入口函数
   * @param {*} cmd     命令字
   * @param {*} params  命令参数数组
   * @returns 
   */
  async execute(cmd, params) {
    if(this.printlog) {
      console.log('远程主机:', this.url);               //打印调测信息
      console.log('命 令 字:', cmd);                    //打印调测信息
      console.log('参数数组:', JSON.stringify(params)); //打印调测信息
      console.log('终 端 号:', this.id);                //打印调测信息
      console.log('令 牌 尾:', this.token);             //打印调测信息
    }

    //构造业务报文
    let packet = {
      method: cmd,                                    //命令字
      params: params,                                 //命令参数数组
      cid: this.id,                                   //终端号
      wid: "primary",                                 //钱包名称，默认都为"primary"
    };

    // 调用 token.random 返回[令牌头]
    let ret = await VALLNET.post(this.url, this.password, {
        "method": "token.random",
        "cid": this.id, //终端授权编号，取固定值
        "wid": "primary",
        "params": [
            this.id,
        ]
    });
    if(this.printlog) {
      console.log('令 牌 头:', ret);    //打印调测信息
    }

    // 计算最终令牌(HEX字符串形式)，crypto.createHmac为标准HMAC算法
    let calc = crypto.createHmac('sha256', ret).update(this.token).digest().toString('hex');
    if(this.printlog) {
      console.log('最终令牌:', calc); //打印调测信息
    }

    //计算报文签名
    let sig = VALLNET.signObj(packet, VALLNET.hash256(Buffer.from(this.token)));
    if(this.printlog) {
      console.log('报文签名:', sig);  //打印调测信息
    }

    //附加最终令牌
    packet.token = calc;
    //附加签名字段
    packet.sig = sig;

    //发起远程调用，返回调用结果
    return await VALLNET.post(this.url, this.password, packet);
  };

  /**
   * 以 GET 方式，访问开放式API
   * @param {*} location 
   */
   async get(location) {
    const newOptions = { json: true };
    location = `${this.url}/public/${location}`;
    
    if(this.printlog) {
      console.log('try get:', location);
    }

    newOptions.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
    };

    try {
      let ret = await fetch(location, newOptions);
      let json = await ret.json();

      if(json.error) {
        return json;
      } else {
        return json.result;
      }
    }
    catch(e) {
      console.error(e);
    }
  }

  /**
   * 等待若干毫秒
   * @param {*} time  等待时间(毫秒) 
   */
  async wait(time) {
    await (async (time) => {return new Promise(resolve => {setTimeout(resolve, time);});})(time);
  } 

  /**
   * 双哈希(SHA256)
   * @param {*} data 
   * @returns 
   */
  static hash256(data) {
    return VALLNET.hash('sha256', VALLNET.hash('sha256', data));
  };

  /**
  * 哈希算法
  * @param {*} alg    //算法类型，如 sha256 
  * @param {*} data   //数据
  * @returns 
  */
  static hash(alg, data) {
    return crypto.createHash(alg).update(data).digest();
  };

  /**
  * 用指定密钥，对指定报文生成并返回签名字段
  * @param {Object}      packet      待签名的报文对象
  * @param {Buffer}      pri         签名私钥，Buffer格式
  * @returns {String}                报文签名的字符串形式
  */
  static signObj(packet, pri) {
    let msg = VALLNET.stringify(packet);
    //console.log('msg', msg);
    msg = Buffer.from(msg); //生成升序紧缩模式字符串

    //secp256k1为选择secp256k1曲线的标准椭圆曲线签名算法

    // npm库的调用方式
    // Sign message
    let sig = secp256k1.sign(VALLNET.hash256(msg), pri);
    // Ensure low S value
    sig = secp256k1.signatureNormalize(sig.signature);
    // Convert to DER
    sig = secp256k1.signatureExport(sig);

    /** 另外一个库的调用方式
    // Sign message and ensure low S value
    const sig = secp256k1.sign(msg, pri, { canonical: true });
    // Convert to DER
    sig = Buffer.from(sig.toDER());
    */

    return sig.toString('hex');
  };

  /**
  * 序列化对象，和 JSON.stringify 不同之处在于，排除了属性排序变化带来的影响，并且不考虑反序列化的需要
  * @param {Object} data      待序列化的对象
  * @param {Array}  exclude   排除的属性名
  */
  static stringify(data, exclude) {
    if(typeof data == 'undefined' || !data) {
      return '';
    } 
    if(typeof data == 'string'){
      return data;
    }
    if(Array.isArray(data)) {
      return data.reduce((sofar,cur)=>{
        sofar += VALLNET.stringify(cur);
        return sofar;
      }, '');
    } else if(typeof data == 'number' || typeof data == 'boolean') {
      return data.toString();
    } else if(typeof data == 'object') {
      let base = '';
      Object.keys(data).sort().map(key=>{
        if(!exclude || !exclude.includes[key]) {
          if(!!data[key]) {
            base += key + VALLNET.stringify(data[key]);
          }     
        }
      });
      return base;
    } else if(Buffer.isBuffer(data)) {
      return data.toString('base64');
    }
    
    return data;
  }

  /**
  * POST 方法，自动封装基本校验头信息
  * @param {*}        url        远程主机地址
  * @param {*}        password   远程主机访问密码
  * @param {Object}   options    访问参数数组
  * @returns 
  */
  static async post(url, password, options) {
    const newOptions = { json: true, method: 'POST', body: JSON.stringify(options) };
      
    let username = 'bitcoinrpc';
    const auth = `${username}:${password}`;
    const data = Buffer.from(auth, 'utf8');

    newOptions.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${data.toString('base64')}`,
    };

    try {
      let ret = await fetch(url, newOptions);
      let json = await ret.json();

      if(!json.error) {
        return json.result;
      } else {
        return json;
      }
    } catch(e) {
      console.error(e);
    }
  }
}

module.exports = VALLNET;