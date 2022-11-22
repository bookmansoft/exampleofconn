const crypto = require('crypto'); //加密依赖库
const secp256k1 = require('secp256k1'); //椭圆曲线库
function hash256(data) {
    return hash('sha256', hash('sha256', data));
};

/**
 * 哈希算法
 * @param {*} alg    //算法类型，如 sha256 
 * @param {*} data   //数据
 * @returns 
 */
function hash(alg, data) {
    return crypto.createHash(alg).update(data).digest();
};

describe('测试', () => {
    it('椭圆曲线', async () => {
        let buf = Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex');
        let msg = Buffer.from('hello','utf-8');
        let msgBuf = hash256(msg);
        console.log('prv', buf.toString('hex'));
        console.log('msg', msgBuf.toString('hex'));
        let sig = secp256k1.sign(msgBuf, buf);
        console.log('sig', sig.signature.toString('hex'));
        sig = secp256k1.signatureNormalize(sig.signature);
        console.log('nor', sig.toString('hex'));
        sig = secp256k1.signatureExport(sig);
        console.log('dre', sig.toString('hex'));
    });
});
