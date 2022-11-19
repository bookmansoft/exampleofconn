const VALLNET = require('./lib/index'); //引入RPC调用类
const config = require('./lib/config'); //引入配置对象

//涉及异步调用，用 async 函数包装后执行
(async () => {
  //创建远程连接对象
  const remote = new VALLNET(config);

  //发起远程调用，携带命令字和参数数组，返回调用结果
  let ret = await remote.execute("block.count", []);

  //打印结果
  console.log('返回结果:', ret);
})().catch((err) => {
  //打印错误西希
  console.error(err);
});
