/**
 * 辅助工具: 发布数字资产，包括：
 * 1. 发布版权品，作为指定产品的BCI证书，同时也视为一种可转移的数字资产。
 * 2. 发布衍生品，作为一种可转移的数字资产。发布时需要指定对应的BCI证书信息。
 * @description 
 * 1. 自动注册CP信息
 * 2. 批量铸造数字藏品
 * 3. 批量转移至离散地址上(在统一支撑平台和区块链节点实时打通后，此项操作不需执行)
 */
 
const assert = require('assert')
const VALLNET = require('../lib/index')
const config = require('../lib/config')
const remote = new VALLNET(config);

//引入外部JSON数据，作为本次铸造内容
let envs = require('./create20221108')

describe('2022.11.08', () => {
	before(async ()=> {
		await remote.execute('miner.setsync.admin', []);
		let ret = await remote.execute('block.tips', []);
		if(ret[0].height < 120) {
			await remote.execute('miner.generate.admin', [120 - ret[0].height]);
			await remote.wait(500);
		}
	  });
	
	for(let env of envs) {
		it('注册CP', async () => {
		  //查询并打印CP信息
		  ret = await remote.execute('cp.byName', [env.cp.name]);
		  if(!ret) {
			//注册一个新的CP
			ret = await remote.execute('cp.create', [env.cp.name, '127.0.0.1,,artist,15']);
			if(ret.error) {
				console.log(ret.error);
			}
			assert(!ret.error);

			await waitblock(1, 5000);
		  }

		  //查询并打印CP信息
		  ret = await remote.execute('cp.byName', [env.cp.name]);
		  assert(!!ret && !ret.error);
		  env.cp.id = ret.cid;
		  console.log("当前CP信息" + JSON.stringify(env.cp.id,));
		});

		it('发行机构登记新地址，为其转发NFT', async () => {
			//NFT编码方案: 表现-品类-专辑-单曲-发行量，例如 NFT视频-剪纸-百年荣光-08奥运-第001件
			let ret = null;
			
			let _start = 0;
			if(!!env.suffixes[2]) {
				_start = (parseInt(env.suffixes[2]) - 1) || 0;
			}
			
			let products = [];
			for(let i = _start; i < _start + env.detail.length; i++) { //每个SKU
				for(let j = 1; j <= env.detail[i - _start]; j++) {
				  let bayc = i+1;
				  if(bayc>9999) {
					  bayc = 0;
				  }
				  
				  ret = await remote.get(`prop/${env.code}-${env.suffixes[0]}-${env.suffixes[1]}-${pad4(bayc)}-${pad12(j)}`);
				  if(ret.length < 1) { //不存在的道具才需要添加
					console.log('添加:',`prop/${env.code}-${env.suffixes[0]}-${env.suffixes[1]}-${pad4(bayc)}-${pad12(j)}`);
					products.push(`${env.cp.id}|${env.code}-${env.suffixes[0]}-${env.suffixes[1]}-${pad4(bayc)}|10000|${env.code}-${env.suffixes[0]}-${env.suffixes[1]}-${pad4(bayc)}-${pad12(j)}`);
				  }
				  if(products.length >= 200) {
					  console.log('上链写入...');
					  ret = await remote.execute('prop.createlist', [json(products)]);
					  assert(!ret.error);

					  products = [];
				  }
				}
			}

			if(products.length > 0) {
				console.log('上链写入...');
				let ret = await remote.execute('prop.createlist', [json(products)]);
				assert(!ret.error);

				products = [];
			}

			//将等待交易全部上链，避免后续操作产生冲突
			while(true) {
				console.log('等待同步...');
				ret = await remote.execute('tx.pending.count', []);
				if(ret == 0) {
					break;
				}
				
				await waitblock(1, 10000);
			}	

			let count = 0, unfinish = 0, repeat = 0;

			let addresses = new Map();

			let props = [];
			for(let i = _start; i < _start + env.detail.length; i++) {
				for(let j = 1; j <= env.detail[i - _start]; j++) {
					count++;

					let bayc = i+1;
					if(bayc>9999) {
						bayc = 0;
					}

					let ret = await remote.get(`prop/${env.code}-${env.suffixes[0]}-${env.suffixes[1]}-${pad4(bayc)}-${pad12(j)}`);
					assert(!ret.error);
					console.log(ret);

					if(addresses.has(ret[0].current.address)) {
					  repeat++;
					  console.log('地址重复', ret[0].pid, ret[0].current.address);
					} else {
					  addresses.set(ret[0].current.address);
					}

					if(ret[0].current.address == ret[1].current.address) {
					  unfinish++;

					  let outpoint = [ret[0].current.hash, ret[0].current.index];
					  ret = await remote.execute('address.create', [null, count + env.history]); //添加了历史发售数量的偏移量
					  assert(!ret.error);

					  console.log('添加:',`${ret.address}|${outpoint[0]}|${outpoint[1]}`);
					  props.push(`${ret.address}|${outpoint[0]}|${outpoint[1]}`);
					  if(props.length >= 200) {
						console.log('转移写入...');
						ret = await remote.execute('prop.sendlist', [props.reduce((sofar, cur)=>{
						  if(sofar!='') {
							sofar += ',';
						  }
						  sofar += cur;
						  return sofar;
						}, '')]);
						if(ret.error) {
						  console.log(ret.error);
						}
						assert(!ret.error);

						props = [];
					  }
					}
				}
			}
			if(props.length > 0) {
			  console.log('转移写入...');
			  let ret = await remote.execute('prop.sendlist', [props.reduce((sofar, cur)=>{
				if(sofar!='') {
				  sofar += ',';
				}
				sofar += cur;
				return sofar;
			  }, '')]);
			  if(ret.error) {
				console.log(ret.error);
			  }
			  assert(!ret.error);

			  props = [];
			}

			//将等待交易全部上链，避免后续操作产生冲突
			while(true) {
				console.log('等待同步...');
				ret = await remote.execute('tx.pending.count', []);
				if(ret == 0) {
					break;
				}
				
				await waitblock(1, 10000);
			}	

			console.log(`共发行${count}件NFT, 补录${unfinish}件，地址重复${repeat}条`);
		});
	}
});

/**
 * GET 方法
 * 1. 根据作者编码，查询作者: /public/cp/:id
 * curl http://127.0.0.1:2002/public/cp/xxxxxxxx-vallnet-boss-xxxxxxxxxxxxxx
 * 2. 根据作者名称，查询作者: /public/cp/name/:name
 * curl http://127.0.0.1:2002/public/cp/name/ATHENA
 * 3. 根据用户编号(无符号整型)，查询地址: /public/addr/reflect/:id
 * curl http://127.0.0.1:2002/public/addr/reflect/:id
 * 4. 根据NFT编码，查询NFT: /public/prop/:id
 * curl http://127.0.0.1:2002/public/prop/xxxxxxxx-vallnet-boss-tokenxxxxx0025
 * 5. 根据交易哈希，查询交易: /public/tx/:hash
 * curl http://127.0.0.1:2002/public/tx/9cac669110c9d44358239f1018df4c8894ffd8a5b63bf904582678d2c962fb17
 */

 function pad12(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(10);

  switch (num.length) {
    case 1:
      return '00000000000' + num;
    case 2:
      return '0000000000' + num;
    case 3:
      return '000000000' + num;
    case 4:
      return '00000000' + num;
    case 5:
      return '0000000' + num;
    case 6:
      return '000000' + num;
    case 7:
      return '00000' + num;
    case 8:
      return '0000' + num;
    case 9:
      return '000' + num;
    case 10:
      return '00' + num;
    case 11:
      return '0' + num;
    case 12:
      return num;
    }
}

function pad4(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(10);

  switch (num.length) {
    case 1:
      return '000' + num;
    case 2:
      return '00' + num;
    case 3:
      return '0' + num;
    case 4:
      return num;
    }
}

/**
 * 等待数据上链
 * @param {*} time 
*/
async function waitblock(block, time) {
	block = block || 1;

	let diff = -1, height = 0;
	while(diff < block) {
		let ret = await remote.execute('block.count', []);
		if(diff == -1) {
			height = ret;
			diff = 0;
		} else {
			diff = ret - height;
		}

		ret = await remote.execute('miner.check', []);
		assert(!ret.error);
		if(!ret.mode) {
			await remote.execute('miner.generate.admin', [block]);
			await remote.wait(1000);
		} else {
			await remote.wait(3000);
		}
	}

	if(!!time) {
		await remote.wait(time);
	}
}

function json(products) {
  let str = '';
  products.map(it=>{
      if(str != '') {
          str += ',';
      }
      str += it;
  });
  return str;
}
