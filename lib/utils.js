const crypto = require('crypto');
const uuid = require('uuid/v1')

function ripemd160(data) {
    return hash('ripemd160', data);
};
  
/**
 * 双哈希
 * @param {*} data 
 * @returns 
 */
function hash256(data) {
    return hash('sha256', hash('sha256', data));
};

function sha256(data) {
    return hash('sha256', data);
};

function hash160(data) {
    return ripemd160(hash('sha256', data));
};
  

function randomHash() {
    return hash256(Buffer.from(uuid())).toString('hex');
}

/**
 * 哈希算法
 * @param {*} alg    //算法类型，如 sha256 
 * @param {*} data   //数据
 * @returns 
 */
function hash(alg, data) {
    return crypto.createHash(alg).update(data).digest();
};

/**
 * 序列化对象，和 JSON.stringify 不同之处在于，排除了属性排序变化带来的影响，并且不考虑反序列化的需要
 * @param {Object} data      待序列化的对象
 * @param {Array}  exclude   排除的属性名
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

function now() {
    return Math.floor(Date.now() / 1000);
};
  
module.exports = {
    stringify,   
    randomHash,
    hash,
    sha256,
    hash160,
    hash256,
    now,
}