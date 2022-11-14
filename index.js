const fetch = require('node-fetch');    //http函数库
const crypto = require('crypto');       //加密依赖库
const secp256k1 = require('secp256k1'); //椭圆曲线库

//主机地址(带端口号)
const url = `http://127.0.0.1:2102/`;

/**
 * 双哈希(SHA256)
 * @param {*} data 
 * @returns 
 */
function hash256(data) {
    return hash('sha256', hash('sha256', data));
};
  
/**
 * 哈希算法
 * @param {*} alg 
 * @param {*} data 
 * @returns 
 */
function hash(alg, data) {
    return crypto.createHash(alg).update(data).digest();
};
  
/**
 * 用指定密钥，对指定报文生成并返回签名字段
 * @param {Object}      packet      待签名的报文对象
 * @param {Buffer}      pri         签名私钥，Buffer格式
 * @returns {String}                报文签名的字符串形式
 */

function signObj(packet, pri) {
    //secp256k1为选择secp256k1曲线的标准椭圆曲线签名算法

    let msg = Buffer.from(stringify(packet)); //生成升序紧缩模式字符串
    // npm库的调用方式
    // Sign message
    let sig = secp256k1.sign(hash256(msg), pri);
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
 */

function stringify(data, exclude) {
    if(typeof data == 'undefined' || !data) {
      return '';
    } 
    if(typeof data == 'string'){
      return data;
    }
    if(Array.isArray(data)) {
      return data.reduce((sofar,cur)=>{
        sofar += stringify(cur);
        return sofar;
      }, '');
    } else if(typeof data == 'number' || typeof data == 'boolean') {
      return data.toString();
    } else if(typeof data == 'object') {
      let base = '';
      Object.keys(data).sort().map(key=>{
        if(!exclude || !exclude.includes[key]) {
          if(!!data[key]) {
            base += key + stringify(data[key]);
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
 * POST 方法，带基本校验头信息
 * @param {*} options 
 * @returns 
 */
async function post(options) {
    const newOptions = { json: true, method: 'POST', body: JSON.stringify(options) };
      
    let username = 'bitcoinrpc', password = 'bookmansoft';
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

      if(json.error) {
        throw(json.error);
      } else {
        return json.result;
      }
    } catch(e) {
      console.error(e);
    }
}

//涉及异步调用，用 async 函数包装后执行
(async () => {
    // 终端获颁证书中的[令牌尾]，由系统管理员分配
    let token = '026190ea1cca7ee8c260c3c7da9501982928860138827d499c985586cfa13c1b03';
    console.log('令牌尾:', token);

    // 调用 token.random 返回[令牌头]
    let ret = await post({
        "method": "token.random",
        "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
        "wid": "primary",
        "params": [
            "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx",
        ]
    });
    console.log('令牌头:', ret);

    // 计算最终令牌(HEX字符串形式)，crypto.createHmac为标准HMAC算法
    let calc = crypto.createHmac('sha256', ret).update(token).digest().toString('hex');
    console.log('最终令牌:', calc);

    //业务报文
    let packet = {
        method: "block.count",                          //命令字
        params: [],                                     //命令参数数组，本示例设为空数组
        cid: "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx",    //终端号
        wid: "primary",                                 //钱包名称，默认都为"primary"
    };
    //计算报文签名
    let sig = signObj(packet, hash256(Buffer.from(token))); 
    console.log('报文签名:', sig);

    //附加最终令牌和签名字段
    packet.token = calc;
    packet.sig = sig;

    //发起远程调用，返回调用结果
    ret = await post(packet); 
    console.log('返回结果:', ret);
})().catch((err) => {
    console.error(err);
});