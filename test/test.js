const secp256k1 = require('secp256k1'); //椭圆曲线库
const utils = require('../lib/utils');

describe('测试', () => {
    it('椭圆曲线', async () => {
        let buf = Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex');
        let msg = Buffer.from('hello','utf-8');
        let msgBuf = utils.hash256(msg);
        console.log('prv', buf.toString('hex'));
        console.log('msg', msgBuf.toString('hex'));
        let sig = secp256k1.sign(msgBuf, buf);
        console.log('sig', sig.signature.toString('hex'));
        sig = secp256k1.signatureNormalize(sig.signature);
        console.log('normalize', sig.toString('hex'));
        sig = secp256k1.signatureExport(sig);
        console.log('dre', sig.toString('hex'));
    });
});
