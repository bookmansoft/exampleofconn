/**
 * 联机单元测试：传家宝业务流程
 * Creted by liub 2020.04.28
 * @description
 * 传家宝(道具管理)指百谷王链所提供的NFT制售机制，包括：
 * 1. 作为道具发行者的厂商的注册管理
 * 2. 道具的发行、流转、回收、竞拍
 */

const uuid = require('uuid/v1')
const assert = require('assert')
const remote = (require('../scripts/connector'))({
    type:   'testnet',
});

let env = {
    cp: {
        name: "stock-cp-"+ uuid().slice(0,27),
        id: '',
    },
    prop: null,
	alice: {
        erid: [],
        name: uuid(),
        address: '',
        prop: "prop-"+ uuid().slice(0,31),
        sn: ()=>{return "oid-alice-"+ uuid().slice(0,26);},     //订单编号
    },
	bob: {
        erid: [],
        name: uuid(),
        address: '',
        prop: "prop-"+ uuid().slice(0,31),
        sn: ()=>{return "oid-bob-"+ uuid().slice(0,28);},     //订单编号
    },
	eve: {
        erid: [],
        name: uuid(),
        address: '',
        prop: "prop-"+ uuid().slice(0,31),
        sn: ()=>{return "oid-eve-"+ uuid().slice(0,28);},     //订单编号
    },
};
let oid = "prop-oid-"+uuid().slice(0,27);

describe('传家宝业务流程', () => {
    before(async () => {
        //开启长连模式
        remote.setmode(remote.CommMode.ws, async () => { });
            
        //订阅并监听消息，该消息不是默认下发，需要事先订阅
        await remote.watch(msg => {
            console.log('prop/receive:', msg);
        }, 'prop/receive').execute('subscribe', ['prop/receive']);

        //确保一定块高度，以便拥有足够多的成熟的余额
        let ret = await remote.execute('block.tips', []);
        if(ret[0].height < 120) {
            await remote.execute('miner.generate.admin', [120 - ret[0].height]);
        }
        await remote.execute('miner.setsync.admin', [true]);
        await remote.wait(500);
    });

    after(()=>{
        remote.close();
    });

    it('机构注册：厂商注册', async () => {
        //注册一个新的CP, 指定 15% 的媒体分成
        let ret = await remote.execute('cp.create', [env.cp.name, '127.0.0.1,,slg,15']);
        assert(!ret.error);

        //确保数据上链
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(500);

        //查询CP信息
        ret = await remote.execute('cp.byName', [env.cp.name]);
        assert(!ret.error);
        env.cp.id = ret.cid;
        env.cp.address = ret.current.address;
        console.log('cp:', env.cp.name);
    });

    it('创建道具：机构创建一个道具', async () => {
        let ret = await remote.execute('prop.create', [env.cp.id, env.cp.name, 10000]);
        assert(!ret.error);

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
        
        ret = await remote.execute('prop.wallet.byoid', [env.cp.name]);
        for(let item of ret.list) {
            env.prop = {pid: item.nd.pid, gold: item.amount, cid: item.nd.cid};
        }
    });

    it('拍卖道具：道具拥有者拍卖道具', async () => {
        if(env.prop) {
            await remote.execute('prop.sale', [env.prop.pid, 30000]);
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);
        } else {
            console.log('Empty Prop List');
        }
    });

    it('竞拍道具：第三方参与竞拍道具', async () => {
        if(env.prop) {
            await remote.execute('prop.buy', [env.prop.pid, 30000]);
            await remote.execute('miner.generate.admin', [1]);
            await remote.wait(1000);
        } else {
            console.log('Empty Sale List');
        }
    });

    it('转移道具：道具拥有者转移一个道具, 显示成功转移后的道具信息', async ()=> {
        //Alice生成一个接收道具的地址
        let ret = await remote.execute('address.create', [env.alice.name]);
        assert(!ret.error);
        env.alice.address = ret.address;

        ret = await remote.execute('prop.send', [env.alice.address, env.prop.pid]);

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('熔铸道具：道具拥有者熔铸一个道具', async () => {
        await remote.execute('prop.found', [env.prop.pid, env.alice.name]);

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1500);

        let ret = await remote.execute('prop.wallet.byoid', [env.cp.name]);
        let count = 0;
        for(let item of ret.list) {
            if(item.pst != 4) {
                count++;
            }
        }
        assert(count == 0);
    });

    it('为指定身份证生成专属链上地址', async ()=>{
        //为alice生成地址
        let ret = await remote.execute('address.create', [env.alice.name]);
        assert(!ret.error);
        env.alice.address = ret.address;
        env.alice.pubkey = ret.publicKey;

        //为bob生成地址
        ret = await remote.execute('address.create', [env.bob.name]);
        assert(!ret.error);
        env.bob.address = ret.address;
        env.bob.pubkey = ret.publicKey;

        //为eve生成地址
        ret = await remote.execute('address.create', [env.eve.name]);
        assert(!ret.error);
        env.eve.address = ret.address;
        env.eve.pubkey = ret.publicKey;
    });

    it('购买积分', async () => {
        //完成支付后为用户添加积分
        for(let i = 0; i < 10; i++) {
            await remote.execute('tx.create', [{"sendnow":true}, [{"value":100000000, "account": env.alice.name}]]);
            await remote.execute('tx.create', [{"sendnow":true}, [{"value":100000000, "account": env.bob.name}]]);
            await remote.execute('tx.create', [{"sendnow":true}, [{"value":100000000, "account": env.eve.name}]]);
        }

        await remote.execute('miner.generate.admin', [1]);
    });

    it('用户将积分赠与第三方', async () => {
        let ret = await remote.execute('tx.send', [env.alice.address, 20000000, env.bob.name]);
        assert(!ret.error);
    });

    it('创建道具', async ()=>{
        let ret = await remote.execute('prop.create', [env.cp.id, oid, 10000]);
        assert(!ret.error);

        env.prop.pid = ret.pid;
    
        //确保该CP数据上链
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('提供礼品二维码生成和核销接口', async () => {
        //模拟赠送道具给用户
        let ret = await remote.execute('prop.send', [env.alice.address, env.prop.pid]);
        assert(!ret.error);

        await remote.execute('miner.generate.admin', [1]);
        //!!停留一段时间，让钱包处理异步事件以更新本地数据库
        await remote.wait(1000);

        //用户转账给商户
        ret = await remote.execute('prop.send', [env.cp.address, env.prop.pid, env.alice.name]);
        console.log(ret.error);

        //确保该CP数据上链
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('使用积分兑换商品', async () => {
        //发起一笔支付交易，使用bob的子账户支付
        let ret = await remote.execute('order.pay', [env.cp.id, env.bob.name, env.bob.sn(), 10000000, env.bob.name]);
        assert(!ret.error);

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);

        //支付成功后，系统发放礼品券
        ret = await remote.execute('prop.send', [env.bob.address, env.prop.pid]);
        assert(!ret.error);

        //确保该CP数据上链
        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('用户间赠送礼品券', async () => {
        //Bob生成道具码
        let ret = await remote.execute('prop.donate', [env.prop.pid, env.bob.name]);
        assert(!ret.error);
        env.prop.raw = ret.raw;

        //Alice接收礼品券
        ret = await remote.execute('prop.receive', [env.prop.raw, env.alice.name]);
        assert(!ret.error);

        await remote.execute('miner.generate.admin', [1]);
        await remote.wait(1000);
    });

    it('按官方牌价八折自动回收礼品券', async () => {
        //用户将道具转入系统账户
        let ret = await remote.execute('prop.send', [env.cp.address, env.prop.pid, env.alice.name]);
        assert(!ret.error);

        await remote.execute('tx.create', [{"sendnow":true}, [{"value":50000000, "account": env.alice.name}]]);
        assert(!ret.error);
    });
});
