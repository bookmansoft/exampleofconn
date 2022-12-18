const fetch = require('node-fetch');    //http函数库
const crypto = require('crypto');       //加密依赖库
const utils = require('../lib/utils');
const verify = require('../lib/verify');

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
    let sig = verify.signObj(packet, utils.hash256(Buffer.from(this.token)));
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