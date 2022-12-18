# RPC接口声明

这篇文档，详细描述了各业务单元的业务重心，以及各业务单元与百谷王链所有交互的[接口描述](#接口描述)。
**关于业务单元与百谷王链的安全连接问题，请参见文档《RPC安全连接》**
**关于百谷王链的部署问题，请参见《基础环境》和《联盟链节点管理》等文档**

## 版权业务平台体系结构说明

版权业务平台包括了版权工作站(多节点)、发行平台(多节点)、门户网站、统一支撑平台等多个业务单元。上述业务单元与作为底层技术设施的百谷王链，共同组成了区块链版权综合运营中心。业务单元调用百谷王链的交互接口，辅助实现各个业务目标。

AI绘画目前还是以小程序方式独立运作，下一阶段再考虑与合适的业务单元进行整合。

### 版权工作站

版权工作站的运营主体是具备内容审核能力的机构，通常为出版社。其主要服务功能包括：
1. 作者注册服务
作者指广义上的IP提供者，可以是个人用户、文创企业、数藏平台、游戏企业等。
作者在平台上完成认证后登录入驻，然后可以在其账号下[注册企业证书](#注册企业证书)。每个作者可以付费注册不限数量的企业证书。

2. 作品存证服务
作者可以在选定的企业证书条目下，上传不限数量的作品，并申请[创建版权品](#创建数字资产)。注意[创建版权品]和[创建数字资产]实际上调用的是同一个接口，只是编码规则有所不同。
关于进阶的[作品自愿登记证明]，作者可以直接上传已有扫描件，也可以发起申请[作品自愿登记证明]。该申请目前需要手工向版权处提交，需要收取合理费用。

3. 作品发行服务
作品完成存证流程后，就可以申请发行，包括发行数量和单价。可以多件作品组合发行。
发行申请需要逐条人工审核，并详细记录审核人、审核时间，要有复审、撤销机制。
申请发行成功后，将通过[创建数字资产](#创建数字资产)操作，形成库存并进入数字藏品中心仓，供后续划拨之用。

4. 作品存证和数字资产浏览服务
系统提供开放式接口，供移动互联网用户随时[浏览作品存证和数字资产](#开放接口)

原则上，版权工作者需要申请独立区块链节点。

### 发行平台

发行平台依托版权工作站提供的数字资产，组织开展销售活动。发行平台的原型是 920.cc
发行平台首先要向中心仓申请配额，然后编排发行计划，包括发行时间、市场价、合成、盲盒、核销兑换、折扣等机制。也可以选择其它发行平台的发行计划，申请帮卖活动。

发行平台依托统一支撑平台，和区块链节点间接交互：
1. 作品转赠服务，调用[转移数字资产](#转移数字资产)接口实现。

### 门户网站(元犀世界)

门户网站的原型是 920.art, 作为面向C端的主力站点，整合拍卖行、*区块链钱包等服务，同时提供和各发行平台、各版权工作站的无缝链接。

门户网站依托统一支撑平台，和区块链节点间接交互:
1. 作品转赠服务，调用[转移数字资产](#转移数字资产)接口实现。

### 统一支撑平台

统一支撑平台负责底层支撑，如身份认证、支付、结算等功能。

统一支撑平台和区块链节点的交互包括：
1. [管理用户地址](#注册用户证书)
2. [转移数字资产](#转移数字资产)

## 接口描述

注：使用 Postman 模拟操作时，目标地址默认为 http://localhost:2102, 访问正式节点端口号请调整为 2002

### 注册用户地址

通过GET方式，传递合适参数，即可生成指定用户独一无二的用户地址，该地址也可以作为用户的DID标示使用：
```js
//根据用户编号(无符号整型)，生成映射地址
//curl http://locahost:2102/public/addr/reflect/:id
```

特别声明：
1. 用户地址是有节点依赖的。统一支撑平台负责为用户指定区块链节点并进行映射，然后要记录该用户归属节点，并缓存地址信息备用。
2. 由于采用代理签署模式，因此用户提交该地址下数字资产的转移请求时，必须要分发到原节点执行。

### 开放接口

```js
/**
 * 根据作者编码，查询作者(开放接口)
 * curl http://locahost:2102/public/cp/:id

 * 根据作者名称，查询作者(开放接口)
 * curl http://locahost:2102/public/cp/name/:name

 * 根据NFT编码，查询NFT(开放接口)
 * curl http://locahost:2102/public/prop/:id

 * 根据交易哈希，查询交易(开放接口)
 * curl http://locahost:2102/public/tx/:hash
 */
```

### 注册企业证书

Post Input

```json
{
  "method": "cp.create",    //命令字：注册企业证书
  "wid": "primary",         //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    "bookmansoft",          //企业名称，可自由拟定，长度在4~50字节之间
    "127.0.0.1,,soft",      //逗分字符串格式的参数素组，当前格式为"企业公网IP地址,,企业类别"，注意第二个参数为置空的保留字段
  ]
}
```

**cp.create.async 是相同功能的异步执行版本**

Post Output

```json
{
    "code": 0,                    //返回码，零表示正常
    "error": null,                //错误信息，NULL表示正常
    "result": {
        "name": "bookmansoft",    //企业名称，和提交请求中企业名称字段保持一致
        "ip": "127.0.0.1",        //公网IP，和提交请求中企业公网IP地址保持一致
        "cid": "a3c92fe0-2809-11eb-bf66-616895c53e56",                                    //企业证书编号，企业唯一标识
        "pubAddress": "tb1qzk0r4w334y0ty4fdaymasm74ej38stxanpav5q",                       //证书注册地址
        "pubKey": "02385b9f0e2f659ec3ea9dd30539cae4ca47bf118384ab207761c81d2294465b86",   //注册地址对应公钥
        "txid": "bf1cc405565e369c481eedce929ebf34c79dddcb10c126bce54ac67211eebbea",       //所在交易编号
        "register": "02385b9f0e2f659ec3ea9dd30539cae4ca47bf118384ab207761c81d2294465b86", //联盟节点标识，等同于 sys.alliance.create 返回的
    },
    "sig": "*"                    //报文签名
}
```

**接口返回中，原[prvKey]字段因为安全原因被取消，可使用[address.key.admin]，输入[pubAddress]，取查询结果中的[privateKey]**

特别声明：
1. 企业证书是有节点依赖的。统一支撑平台负责为机构分配节点，生成企业证书，然后要记录该企业归属节点，并缓存证书信息备用。
2. 数字资产初始发行时，会全部投放至企业证书中指定的地址上。
3. 由于采用代理签署模式，因此未来和此企业证书相关的数字资产的转移请求，必须要分发到原节点执行。

### 查询地址对应私钥

Post Input

```json
{
  "method": "address.key.admin",    //命令字：查询地址对应私钥，查询成功的前提是，当前钱包拥有该地址所有权
  "wid": "primary",                 //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    "address",                      //地址
  ]
}
```

Post Output

```json
{
    "code": 0,                    //返回码，零表示正常
    "error": null,                //错误信息，NULL表示正常
    "result": {
      "privateKey": "0db5212758673a432833f6ce6e00ae145f6440bb228a3d643a544df92c49fbcf",
      "publicKey": "032b789bf38a83b7355f7095a60cb67313a1506ecec99f478f593ee19e2fec3039",
      "address": "tb1qr7mdpwmg4y6552lj3tmgz7dml8as5w873rh635"
    },
    "sig": "*"                    //报文签名
}
```

### 查询当前节点注册企业证书

**注意：查询前注册必须得到确认，手动记账模式下，需要先执行 miner.generate.admin 1 再查询**

Post Input

```json
{
  "method": "cp.byName",    //命令字：查询当前节点注册企业证书
  "wid": "primary",         //钱包编号，固定"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    "bookmansoft"           //企业名称，必须是先前已经注册成功的企业名称
  ]
}
```

Post Output

```json
{
    "code": 0,
    "error": null,
    "result": {
        "cid": "86cefc90-280d-11eb-ad4e-a1d30db67998",                                  //企业证书编号
        "name": "bookmansoft",                                                          //企业名称
        "ip": "127.0.0.1",                                                              //公网IP
        "cls": "",                                                                      //类别
        "pubAddress": "tb1q0lh9d8drhf4rzgm5n9zg0ls4yew5n6l229uxeh",                     //证书注册地址
        "pubKey": "027136a848b247f3976cc36c988dacabaaf5c3832a61e70f02e3e9f116a0a80a54", //注册地址对应公钥
        "register": "02385b9f0e2f659ec3ea9dd30539cae4ca47bf118384ab207761c81d2294465b86", //联盟节点标识，等同于 sys.alliance.create 返回的
        "height": 101,                                                                  //所在区块高度，表示已上链
    },
    "sig": "*"                                                                          //报文签名
}
```

返回信息中最重要的是[cid], 企业证书编号，是企业在链态上的全局唯一编号

### 查询全局企业证书

Post Input

```json
{
  "method": "cp.remoteQuery", //命令字：查询全局企业证书
  "wid": "primary",           //钱包编号，固定"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    [//这是一个查询条件数组，可组合多种查询方式，比如"企业名称为bookmansoft"、"分类信息为soft"
      ["name", "bookmansoft"],
      ["cls", "soft"],
    ],
  ]
}
```

Post Output

```json
{
    "list": [
      {
        "cid": "86cefc90-280d-11eb-ad4e-a1d30db67998",                                  //企业证书编号
        "name": "bookmansoft",                                                          //企业名称
        "ip": "127.0.0.1",                                                              //公网IP
        "pubAddress": "tb1q0lh9d8drhf4rzgm5n9zg0ls4yew5n6l229uxeh",                     //证书注册地址
        "pubKey": "027136a848b247f3976cc36c988dacabaaf5c3832a61e70f02e3e9f116a0a80a54", //注册地址对应公钥
        "register": "02385b9f0e2f659ec3ea9dd30539cae4ca47bf118384ab207761c81d2294465b86", //联盟节点标识，等同于 sys.alliance.create 返回的
        "height": 101,                                                                  //所在区块高度，表示已上链
      }
    ],
    "count": 1,
    "page": 1,
    "cur": 1,
    "countCur": 1
}
```

### 判断地址是否归属当前节点

```bash
# 查询钱包是否包含指定地址 地址参数 
address.has address
```

Property | Description
---|---
address  | 地址参数

### 见证电子存证

```bash
# 见证一份电子存证 签发证书 证书对象 见证地址 [证书公钥]
ca.issue.public cert witness [pubkey]
```

Property   | Description
---|---
cert       | 证书对象，包含名称、内容、有效期、索引等字段
cert.hash  | 证书内容哈希(64字节HEX字符串)
cert.height| 有效期限, 以相对块高度表示, 填0表示截止(当前高度+2016)前保持有效
witness    | 见证地址，注意当前节点必须包含该地址控制权
pubkey     | 证书签名公钥，用于电子合同场景

### 吊销电子存证

```bash
# 吊销指定电子存证 废止信息数组(支持批处理)
ca.abolish.public [[erid height [openid]], ...]
```

Property  | Description
---|---
ar        | 废止信息数组
ar.erid   | 废止证书编号
ar.height | 废止高度, 以相对块高度表示, 0表示立即生效

备注: 只有见证发起人才有权限废止已发布见证

### 创建数字资产

```bash
# 创建数字资产 资产唯一编号 资产分类编号 铸造成本 [发起账号]
prop.create cid oid gold pid [openid]
```

Property | Description
---|---
cid         |   资产归属企业编号
oid         |   资产分类编号
gold        |   铸造成本
pid         |   资产唯一编号
openid      |   发起账号

### 转移数字资产

```bash
prop.send addr pid [openid]
```

Property | Description
---|---
addr        |   转移的目标地址
pid         |   资产唯一编号
openid      |   发起账号

### 批量创建数字资产

```bash
#(cid|oid|gold|pid)(n,) 是逗分道具数组，即"作者编码|分类码|含金量|道具编号,..."，如不带道具编号，系统会随机编码
prop.createlist (cid|oid|gold|pid)(n,) [openid]: 批量创建道具 道具信息数组 [发起账户]
```

[POST-Request]
```json
{
    "method":   "prop.createlist",           //接口方法名称
    "params":   [
      "作者编码|分类码|含金量|道具编号, ...",  //用逗分字符串形式，一次性包含多笔NFT铸造信息，含金量目前固定填10000
    ],
    "wid":      "primary",                  //钱包编码，固定填写 primary
    "cid":      "**",                       //操作员编码
    "token":    "",                         //[访问令牌，需要计算得出]
    "sig":      ""                          //[报文签名，需要计算得出]
}
```

[POST-Response]
```json
{
  "code": 0,
  "error": null,
  "result": [
    {
      "cid": "c5f7d5e0-1ecf-11ec-9a4f-25dee2b1d9fd",  //作者编码
      "oid": "papercut-pc-hundred-0001-0001",         //附加码
      "gold": 10000,                                  //含金量
      "pid": "c83fca10-1ecf-11ec-9a4f-25dee2b1d9fd",  //NFT唯一码
      "txid": "2eadcca00c801c381fd5ff39e6efa2211a658c96ae71d6914613ca9406fa9020", //NFT所在交易的哈希值    
      "index": 0,                                     //NFT在所在交易内的索引号(每笔交易可能包含多个NFT)
    },
    {
      "cid": "c5f7d5e0-1ecf-11ec-9a4f-25dee2b1d9fd",  //作者编码
      "oid": "papercut-pc-hundred-0001-0002",         //附加码
      "gold": 10000,                                  //含金量
      "pid": "c83fca10-1ecf-11ec-9a4f-25dee2b1d9tt",  //NFT唯一码
      "txid": "2eadcca00c801c381fd5ff39e6efa2211a658c96ae71d6914613ca9406fa9020", //NFT所在交易的哈希值    
      "index": 1,                                     //NFT在所在交易内的索引号(每笔交易可能包含多个NFT)
    },
  ]
}
```

### 批量转移数字资产

```bash
prop.sendlist (addr|txid|index)(n,) [openid]: 批量转移道具 道具数组(目标地址|道具所在交易哈希|交易内索引) [子账户]'
```

Property | Description
---|---
array       |   逗分字符串组成的道具数组，格式为 "目标地址|道具所在交易哈希|交易内索引, ..."
openid      |   发起账号


### 转账 tx.send

该指令利用地址字符串指定接收单位，向其转账指定数额的通证

Post Input

```json
{
  "method": "tx.send",              //命令字：转账
  "wid": "primary",                 //钱包编号，固定"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    "address",                      //转账目标地址
    "amount",                       //转账数额
    "account",                      //转账发起账号
  ]
}
```

Post Output

```json
{
  "code": 0,
  "error": null,
  "result": {
    "hash": "42e16606246c9ec0df71694aa1f988f44d5cc7c61d19a97d6e9bc8614abfab4b",
    "date": "2020-11-17T15:39:53Z",
    "inputs": [],
    "outputs": [
      {
        "value": 100000000,                                       //转账数额
        "address": "tb1qx98glvphcj5muzyvadphzal7sw5xfljljd44yn",  //转账目标地址
      }
    ],
    "tx": "*"
  },
  "sig": "*"
}
```

### 手动记账

可以使用特定指令开启自动记账，但调测阶段建议使用手动记账。
由于通证激活需要一定高度，故系统运行之初，要先手工记账100。在企业注册调用后，也需手工记账1，以使得该注册得到确认，此后方可查询

Post Input

```json
{
  "method": "miner.generate.admin", //命令字：手动记账
  "wid": "primary",                 //钱包编号，固定"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    100,                            //记账数量
  ]
}
```

Post Output

```json
{
    "code": 0,                      //返回码，零表示执行成功
    "error": null,                  //错误信息，NULL表示执行成功
    "result": [
        "*",                        //新区块的哈希值
    ],
    "sig": "*"                      //报文签名
}
```

### 查询账户余额

Post Input

```json
{
    "method": "balance.all",        //命令字：查询账户余额
    "wid": "primary",                 //钱包编号，固定"primary"
    "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
    "params": ["cid"]               //账户名称，本场景下使用企业证书编号
}
```

Post Output

```json
    "code": 0,                      
    "error": null,                  
    "result":{
        "wid": 1,
        "id": "primary",
        "account": 663665735,       //账户内部索引编号
        "unconfirmed": 500000000,   //余额数值，但未完全确认(可能有部分数据尚未上链)
        "confirmed": 0,             //余额数值，相关数据已全部上链
        "locked": 0,                //冻结额度(锁仓)
    },
    "sig": "*"                      
```

### 创建节点证书

Post Input

```json
{
  "method": "sys.alliance.create",   //命令字：创建节点证书
  "wid": "primary",                 //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    "password",                     //备份密码，盟友节点启动时，需要提供此密码以读取节点证书
    "nodeid",                       //盟友节点编号
    "alliancename",                  //盟友组织称谓
    "host",                         //盟友节点地址，格式如'127.0.0.1:2100'
  ]
}
```

**此命令只在盟主主力节点上执行，在其它节点上执行无意义**

Post Output

```json
{
  "code": 0,
  "error": null,
  "result": {
    "nodeid": "",                                   //节点编号
    "alliancename": "",                              //联盟名称
    "publicKey": "",                                //联盟根密钥的公钥HEX字符串(length=66)，可作为联盟节点标识
    "file": "testnet-bookman-1.keystore",           //节点证书文件名。命令执行后，会在项目根目录下生成同名文件
  }, 
  "sig": "*"
}
```

**盟友从盟主处获取该文件后，置于主力节点项目根目录下，携带证书名称、备份密码等参数启动节点，读取并设置各项内容**

### 吊销节点证书

Post Input

```json
{
  "method": "sys.alliance.delete",   //命令字：吊销节点证书
  "wid": "primary",                 //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    "nodeid",                       //盟友节点编号
    "alliancename",                  //盟友组织称谓
  ]
}
```

**此命令只在盟主主力节点上执行，在其它节点上执行无意义**
**2.2.7新增自动广播功能，盟友节点无需手动移除信道密钥**

Post Output

```json
{
  "code": 0,
  "error": null,
  "result": null, 
  "sig": "*"
}
```

### 列表节点证书

Post Input

```json
{
  "method": "sys.alliance.list",     //命令字：列表节点证书
  "wid": "primary",                 //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
  ]
}
```

**此命令只在盟主主力节点上执行，在其它节点上执行无意义**

Post Output

```json
{
  "code": 0,
  "error": null,
  "result": [
    {
      "name": "bookman",        //盟友名称
      "id": "1",                //盟友节点编号
      "cert": "*",              //证书加密文本
      "password": "bookmansoft",//证书解密密码
      "address": "tb1q3u6vja67p927kqw9r8jvh3pu4d2nj8yar3ehv8",  //选举地址
      "host": "127.0.0.1:2110", //主机地址
      "voted": false            //是否是当选记账节点
    }
  ],
  "sig": "*"
}
```

### 获取联盟信息

Post Input

```json
{
  "method": "sys.alliance.info",     //命令字：获取联盟信息
  "wid": "primary",                 //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
  ]
}
```

Post Output

```json
{
  "code": 0,
  "error": null,
  "result": {
    "alliancePrivateKey": "2ea4c949f7fad75ebe0ec870c03bc1de16cedc3acef45ee95c3d6201dc37ef2d",  //联盟根私钥
    "peerIdentity": "020a73ed97d23522cdb2ca37133e14404715cb963df68d873b68c6dc0971485331",     //节点信道密钥
    "awardAddress": "tb1qyuf5h029xlvqvj6lttusalzyezr4vnl5aa86zv",                             //节点选举地址
    "allianceName": "root",                                                                    //盟友组织名称
    "allianceNodeId": 0                                                                        //节点编号
  },
  "sig": "*"
}
```

### 批量导出节点证书

Post Input

```json
{
  "method": "sys.alliance.export",   //命令字：导出节点证书
  "wid": "primary",                 //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
  ]
}
```

**此命令只在盟主主力节点上执行，在其它节点上执行无意义**

Post Output

```json
{
  "code": 0,
  "error": null,
  "result": null,
  "sig": "*"
}
```

**会批量导出名为 testnet-alliancename-nodeid.keystore 的节点证书**

### 批量充值盟友节点

Post Input

```json
{
  "method": "sys.alliance.refresh",  //命令字：批量充值盟友节点
  "wid": "primary",                 //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
    "100000000",                    //批量转账数额，单位 Dust
  ]
}
```

**此命令只在盟主主力节点上执行，在其它节点上执行无意义**

Post Output

```json
{
  "code": 0,
  "error": null,
  "result": null,
  "sig": "*"
}
```

### 查看可信信道

Post Input

```json
{
  "method": "sys.alliance.getpeer",  //命令字：查看可信信道
  "wid": "primary",                 //钱包编号，固定为"primary"
  "cid": "xxxxxxxx-vallnet-root-xxxxxxxxxxxxxx", //终端授权编号，取固定值
  "params": [
  ]
}
```

Post Output

```json
{
  "code": 0,
  "error": null,
  "result": {
      "peer": [],   //可信信道
      "key": [],    //可信公钥
  }
}
```

