/**
 * 联机单元测试：本地全节点提供运行时环境
 */
const uuid = require('uuid/v1');
const config = require('../lib/config');    //引入配置对象
const VALLNET = require('../lib/index');
const remote = new VALLNET(config);         //创建RPC实例

//在多个测试用例间传递中间结果的缓存变量
let env = {
    name: "prop-"+ uuid().slice(0,31),
}; 
let oid = "prop-oid-"+uuid().slice(0,27);

describe('道具管理流程', () => {
    before(async () => {
        //确保系统满足前置条件，如高度超过100
        await remote.execute('miner.setsync.admin', [true]);
        let ret = await remote.execute('block.tips', []);
        if(ret[0].height < 100) {
            await remote.execute('miner.generate.admin', [100 - ret[0].height]);
            await remote.wait(3000);
        }
    });

    it('注册CP', async () => {
        await remote.execute('miner.setsync.admin', []);

        //注册一个新的CP
        let ret = await remote.execute('cp.create', [env.name, '127.0.0.1,,slg,15']);

        //确保该CP数据上链
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(3000);

        //查询并打印CP信息
        ret = await remote.execute('cp.byName', [env.name]);
        env.cid = ret.cid;
        env.addr = ret.current.address;
        console.log(env);
    });

    it('创建一个道具', async ()=>{
        if(env.cid) {
            let ret = await remote.execute('prop.create', [env.cid, oid, 10000]);
            if(!!ret) {
                env.hash = ret.hash;
                env.pid = ret.pid;
            }
            console.log(env);

            //确保数据上链
            await remote.execute('miner.generate.admin', [2]);
            await remote.wait(5000);
        } else {
            console.log('缺乏厂商信息，无法生成道具');
        }
    });

    it('转移一个道具, 显示成功转移后的道具信息', async ()=> {
        if(env.pid) {
            let ret = await remote.execute('prop.send', [env.addr, env.pid]);
            if(!!ret) {
                env.hash = ret.hash;
            }

            //确保数据上链
            await remote.execute('miner.generate.admin', [2]);
            await remote.wait(5000);
        } else {
            console.log('缺乏原始道具信息，无法转移道具');
        }
    });

    it('熔铸一个道具', async () => {
        if(env.pid) {
            await remote.execute('prop.found', [env.pid]);

            await remote.execute('miner.generate.admin', [2]);
            await remote.wait(5000);

            let ret = await remote.execute('prop.wallet.byoid', [oid]);
            let count = 0;
            for(let item of ret.list) {
                if(item.pst != 4) {
                    count++;
                    console.log(item);
                }
            }
            console.log('count:', count);
        } else {
            console.log('缺乏原始道具信息，无法熔铸道具');
        }
    });
});
