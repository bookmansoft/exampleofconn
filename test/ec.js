/**
 * 单元测试：GIP0024 电子签章
 * Creted by liub 2020.04.20
 */

const assert = require('assert');
const uuid = require('uuid/v1');
const config = require('../lib/config');    //引入配置对象
const utils = require('../lib/utils');
const verify = require('../lib/verify');
const VALLNET = require('../lib/index');
const remote = new VALLNET(config);         //创建RPC实例

let env = {
    alice: {name: "cp-"+ uuid().slice(0,33), erid:[]},
    bob: {name: "cp-"+ uuid().slice(0,33), erid:[]},
    //电子合同对象
    agreement: {
        title: 'agreement',
        body: 'hello world',
    }
};

describe('GIP0024 电子签章', function() {
    it('Alice生成地址', async () => {
        let ret = await remote.execute('address.create.admin', [env.alice.name]);
        assert(!ret.error);
        env.alice.address = ret.address;
        env.alice.pubkey = ret.publicKey;
        env.alice.prikey = ret.privateKey;
    });

    it('Bob生成地址', async () => {
        let ret = await remote.execute('address.create.admin', [env.bob.name]);
        assert(!ret.error);
        env.bob.address = ret.address;
        env.bob.pubkey = ret.publicKey;
        env.bob.prikey = ret.privateKey;
    });

    it('分发通证', async () => {
        await remote.execute('tx.send', [env.bob.address, 100000000]);

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('个人签发: Bob签发证书', async () => {
        let ret = await remote.execute('ca.issue.public', [
            {
                hash: utils.randomHash(),   //实体证书内容哈希(64字节HEX字符串)
                height: 0,                  //有效期，填0表示使用默认值
            },
            env.bob.address,                //见证地址, 当前钱包必须拥有该地址的控制权
        ]);
        assert(ret.erid);
        /**
        {
            oper: 'erIssue',
            erid: 'a5ea2519a44cf11dedfb8c886eded86f5d69d780e3593920d6d6679dd1169c1f',
            witness: '0385e91443559236cc5dfc59dba6f3b06b84f5862b907d836002d70705a80a797f',
            validHeight: 2752,
            startHeight: 0,
            signature: '3044022071828ebf4815ebf7da27a84028aade06aa1dde1cbb85755aeab887bc7a5c323302202a864597be475bcb628f0f8059f417d882ff83a7a2c218b7583d32baa6bb382b',
            source: {
                subjectName: 'a5ea2519a44cf11dedfb8c886eded86f5d69d780e3593920d6d6679dd1169c1f',
                pubkey: '',
                subjectHash: 'a5ea2519a44cf11dedfb8c886eded86f5d69d780e3593920d6d6679dd1169c1f',
                cluster: '',
                cid: '',
                uid: 0
            }
        }
         */
        env.alice.erid.unshift(ret.erid); //缓存erid

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('查询证书: 根据证书编号查询证书内容', async () => {
        let erid = env.alice.erid[0];

        let ret = await remote.execute('ca.list', [[['erid', erid]]]);
        assert(ret.list[0].erid == erid);
    });

    it('查询列表：查询本地证书列表', async () => {
        let erid = env.alice.erid[0];

        let ret = await remote.execute('ca.list.me', [[['erid', erid]]]);
        assert(ret.list[0].erid == erid);
    });

    it('验证证书：验证证书的有效性', async () => {
        let erid = env.alice.erid[0];

        let ret = await remote.execute('ca.verify', [erid]);
        assert(ret && ret.verify);
    });

    it('废止证书: Bob废止先前为Alice签发的证书', async () => {
        //注意入参为数组形式，支持批处理
        let ret = await remote.execute('ca.abolish.public', [
            [[
                env.alice.erid[0],  /*存证编号*/
                0,
            ]],
        ]);
        assert(!ret.error);

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(500);
    });

    it('查询废止: 查询电子证书废止记录列表', async () => {
        let ret = await remote.execute('ca.list.ab', [[['erid', env.alice.erid[0]]]]);
        assert(ret.count == 1 && ret.list[0].erid == env.alice.erid[0]);
    });

    it('验证证书: 验证指定证书已失效', async () => {
        let ret = await remote.execute('ca.verify', [env.alice.erid[0]]);
        assert(ret && !ret.verify);
    });

    it('签署电子合同: Alice和Bob签署电子合同', async () => {
        //Alice本地签署合同
        env.alice.agreement = verify.signData(env.agreement, {
            network: 'testnet',
            alice_prv: env.alice.prikey,
            alice_pub: env.alice.pubkey,
            alice_add: env.alice.address,
            witness: true,
            cid: 'bookman',
        });
        // agreement: {
        //     data: {
        //         title: 'agreement',
        //         body: 'hello world',
        //         cid: 'bookman',
        //         addr: 'tb1qjjzznckmdfha7jty7v8vael4llr2047ufvwe9c',
        //         pubkey: '032dcb7ad0186098d0be4f425c71cac5da0328b0de641a9721b6d003cabb707209'
        //     },
        //     sig: '*'
        // }

        //Bob开始签署合同
        //1. 校验合同签名有消息
        assert.strictEqual(true, verify.verifyData(env.alice.agreement));
        //2. 取合同内容的哈希值
        let content = utils.sha256(JSON.stringify(env.alice.agreement.data)).toString('hex');
        //3. 将合同哈希值和合同签名公钥，使用见证指令上链
        let ret = await remote.execute('ca.issue.public', [
            {
                hash: content,                         //存证哈希
                height: 0,                             //有效高度
            },
            env.bob.address,                          //见证地址
            env.alice.agreement.data.pubkey,          //目标地址公钥
        ]);
        assert(ret.erid);
        env.bob.erid.unshift(ret.erid);

        await remote.execute('miner.generate.admin', [1]);
    });

    it('验证电子合同: 第三方检索验证Alice和Bob签署的电子合同', async () => {
        //检索合同
        let ret = await remote.execute('ca.list', [[['erid', env.bob.erid[0]]]]);
        /** ret.list[0]
            {
                oper: 'erIssue',
                erid: '9ad56350-caa2-11ea-af83-0768c3780f90',
                witness: '039ba89a71f7b16a5acacb7f7231f4812ae81f479277111ec4422f279dfa36f107',
                validHeight: 2618,
                signature: '3044022024972da0e328b83ce7e04812eb23379203f632661271c1da8cc757764fcb7f8902202d2f59c59632edc6cb730537f1b33da13df5c6ff029f097cc98cdc47a588eb77',
                source: {
                    subjectName: '9ad56350-caa2-11ea-af83-0768c3780f90',
                    pubkey: '02eb41fd23bc2f6de753fd685ab5154f81e476e9879463134a40d53c0bdec4c6a9',
                    subjectHash: 'cdfbc9c7f626c834eab70c05654391fecdc5e47412157b2d6e2186eeaae9ef12'
                },
                wid: 0,
                account: ''
            }
         */

        await verifyContract(env.alice.agreement, ret.list[0]);
    });

    before(async ()=>{
        await remote.execute('miner.setsync.admin', [true]);
        let ret = await remote.execute('block.tips', []);
        if(ret[0].height < 120) {
            await remote.execute('miner.generate.admin', [120 - ret[0].height]);
        }
    });
});

/**
 * 电子合同第三方验证流程
 * @param {*} signed    带Alice签名的电子合同文本
 * @param {*} result    主网公布的电子合同凭证
 */
async function verifyContract(signed, result) {
    assert(!!result);

    //验证本地合同是自洽的(经过了Alice的签名)
    assert.strictEqual(true, verify.verifyData(signed));

    //验证本地合同中的公钥和链上合同中的公钥一致(合同哈希值和签名公钥已经上链存证)
    assert.strictEqual(result.source.pubkey, signed.data.pubkey);

    //验证本地合同中的哈希值和链上合同中的哈希值一致
    assert.strictEqual(result.source.subjectHash, utils.sha256(JSON.stringify(signed.data)).toString('hex'));
    
    //验证链上合同是自洽的(经过了Bob的见证)
    let ret = await remote.execute('ca.verify', [result.erid]);
    assert(ret && ret.verify);
    assert(ret.witness == env.bob.pubkey);
}