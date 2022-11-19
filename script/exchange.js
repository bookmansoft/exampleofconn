/**
 * 辅助工具: 批量转移数字藏品
 * @description
 * 1. 准备批处理文本文件cont.txt, 内容格式为多行逗分字符串:
 * nft-pid, sim-address
 * ...
 * 
 * 2. 执行批处理命令，批量转移NFT至目标地址
 * mocha script/exchange --content=script/cont.txt
 */
 
const assert = require('assert')
const VALLNET = require('../lib/index')
const config = require('../lib/config')
const remote = new VALLNET(config);
const fs = require('../lib/fs');

//环境变量, 例如通过行命令传入的批处理文本文件名
let env = {};

//转账记录列表
let exchangeList = [];

describe('批量转移NFT', () => {
	it('读取批处理文本', async () => {
		let arguments = process.argv.splice(3);
		for(let arg of arguments) {
			if(arg.slice(0,2) == '--') {
				let items = arg.slice(2).split('=');
				if(items.length == 2) {
					if(items[1] == 'true') {
						env[`${items[0]}`] = true;
					} else if(items[1] == 'false') {
						env[`${items[0]}`] = false;
					} else {
						env[`${items[0]}`] = items[1];
					}
				}
			} else if(arg.slice(0,1) == '-') {
				env[`${arg.slice(1)}`] = true;
			}
		}
		if(!!env['content']) {
			console.log('开始读取批处理文件 - ', env['content']);

			await readKnown(env['content']);
		} else {
			console.log('Error: 命令格式应为 mocha test/batchExchange --content=test/cont.txt');
		}
	});

	it('批量转移NFT', async () => {
		await remote.execute('miner.setsync.admin', []);

		let _find = false;

		let $sf = async props => {
			let ret = await remote.execute('prop.sendlist', [props.reduce((sofar, cur)=>{
				if(sofar!='') {
				  sofar += ',';
				}
				sofar += cur;
				return sofar;
			}, ''), '*']);
			 
			if(ret.error) {
				console.log(ret.error);
			}
			assert(!ret.error);
		}

		let props = [];
		for(let i = 0; i < exchangeList.length; i++) {
			let ret = await remote.get(`prop/${exchangeList[i].pid}`);
			if(ret.error) {
				console.log(exchangeList.length, `prop/${exchangeList[i].pid}`, ret.error);
				continue;
			}
			if(ret.length > 0) {
				if(ret[0].current.address == exchangeList[i].dst) {
					console.log('道具已转移', ret[0].pid, ret[0].current.address);
				} else {
					_find = true;
					let outpoint = [ret[0].current.hash, ret[0].current.index];
					console.log('道具待转移', ret[0].pid, ret[0].current.address, exchangeList[i].dst);
					props.push(`${exchangeList[i].dst}|${outpoint[0]}|${outpoint[1]}`);
				}
			}

			if(props.length >= 200) {
				await $sf(props);
				props = [];
			}
		}

		if(props.length > 0) {
			await $sf(props);
			props = [];
		}

		//等待交易全部上链，避免后续操作产生冲突
		if(_find) {
			while(true) {
				let ret = await remote.execute('tx.pending.count', []);
				if(ret == 0) {
					break;
				}
				
				await waitblock(1, 10000);
			}	
		}
	});
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

  let ret = await remote.execute('miner.check', []);
  if(!!ret.mode) {
      //#region 在自动记账模式下的执行模式
      let diff = -1, height = 0;
      while(diff < block) {
          let ret = await remote.execute('block.count', []);
          if(diff == -1) {
              height = ret;
              diff = 0;
          } else {
              diff = ret - height;
          }
          await remote.wait(3000);
      }
      //#endregion
  } else {
      //#region 在手动记账模式下的执行模式
      ret = await remote.execute('miner.generate.admin', [block]);
      assert(!ret.error);
      //#endregion
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

async function readKnown(file) {
	if (fs.unsupported)
		return;

	let text;
	try {
		text = await fs.readFile(file, 'utf8');
	} catch (e) {
		console.log(e.message);
		if (e.code === 'ENOENT')
			return;
		throw e;
	}

	parseKnown(text);
};

/**
 * Parse known peers.
 * @param {String} text
 * @returns {Object}
 */

function parseKnown(text) {
	assert(typeof text === 'string');

	if (text.charCodeAt(0) === 0xfeff)
		text = text.substring(1);

	text = text.replace(/\r\n/g, '\n');
	text = text.replace(/\r/g, '\n');

	let addresses = new Map();

	for (const chunk of text.split('\n')) {
		const line = chunk.trim();

		if (line.length === 0)
			continue;

		if (line[0] === '#')
			continue;
		
		if(addresses.has(line)) {
		  console.log('指令重复', line);
  		  continue;
		} else {
		  addresses.set(line);
		}

		const items = line.split(',');

		if (items.length >= 2) {
			exchangeList.push({pid: items[0], dst: items[1]});
			//console.log(items[0], '=>', items[1]);
		}
	}
};
