const CONFIG = {
  "WebApi": "https://www.anisopteragames.com/sync/index.cgi?version=20220806&key=%3Ckey_removed%3E&op=download_agents&count=50&p=8000",
  "WebRespFileName": "respApi.txt",
  "PrefixBackupFilename": "_",
  "KeywordAgent": "blueprints",
  "KeywordName": "name",
  "HistoryFilename": "history.txt",
  "DataFolder": "data",
  "AgentDirectory": "D:\\SteamLibrary\\steamapps\\common\\Reassembly\\data\\The_Agents_Folder"
};

const https = require('node:https');
const fs = require('node:fs');
const { createGzip } = require('node:zlib');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');

const backupFilename = CONFIG["PrefixBackupFilename"] + CONFIG["WebRespFileName"];
const now = Date.now();
const enc = { "encoding": "utf-8" };
const pipe = promisify(pipeline);

//レスポンスファイルがあるか
if (fs.existsSync(CONFIG["WebRespFileName"])) {
  //バックアップファイルがあるか
  if (fs.existsSync(backupFilename)) {
    fs.unlinkSync(backupFilename);
  }

  fs.copyFileSync(CONFIG["WebRespFileName"], backupFilename);
  fs.unlinkSync(CONFIG["WebRespFileName"]);
}

//データフォルダが無いか
if (!fs.existsSync(CONFIG["DataFolder"])) {
  fs.mkdirSync(CONFIG["DataFolder"]);
}

//エージェントデータ取得
function getAgentData() {
  https.get(CONFIG["WebApi"],
    (res) => {
      console.log('statusCode:', res.statusCode);
      console.log('headers:', res.headers);
      res.on('data', (d) => {
        fs.appendFileSync(CONFIG["WebRespFileName"], d, enc);
        let stat = fs.statSync(CONFIG["WebRespFileName"]);
        console.log([stat["size"], res.headers["content-length"]].join("/"));
      });
    }).on('error', (e) => {
      console.error(e);
    }).on('close', (e) => {
      //後処理
      after();
    });
}

//後処理
async function after() {
  let indexStart = 0;
  let count = 0;
  let indexKeyword;
  let respWeb = fs.readFileSync(CONFIG["WebRespFileName"], enc);

  //1艦隊分の処理をするループ
  do {
    indexKeyword = respWeb.indexOf(CONFIG["KeywordAgent"], indexStart);

    //艦隊データが無いか
    if (indexKeyword == -1) {
      continue;
    }

    indexStart = respWeb.lastIndexOf("{", indexKeyword);
    let tmpIndexStart = indexStart;
    indexStart = indexKeyword + 1;
    let indexNextKeyword = respWeb.indexOf(CONFIG["KeywordAgent"], indexStart);
    let indexEnd;

    //最後の艦隊データでは無いか
    if (indexNextKeyword != -1) {
      indexEnd = respWeb.lastIndexOf("}", indexNextKeyword);
    } else {
      indexEnd = respWeb.lastIndexOf("}}");
    }

    let agent = respWeb.substring(tmpIndexStart, indexEnd + 1);
    let filenameLua = now + "_" + count + ".lua";
    let filepathLua = CONFIG["DataFolder"] + "\\" + filenameLua;
    fs.writeFileSync(filepathLua, agent, enc);
    let indexNameStart = agent.indexOf(CONFIG["KeywordName"]);
    let indexNameEnd = agent.indexOf(",", indexNameStart);
    let name = agent.substring(indexNameStart + CONFIG["KeywordName"].length + 2, indexNameEnd - 1);
    fs.appendFileSync(CONFIG["HistoryFilename"], filenameLua + " " + name + "\n", enc);

    //圧縮
    await do_gzip(filepathLua, filepathLua + ".gz");

    fs.copyFileSync(filepathLua + ".gz", CONFIG["AgentDirectory"] + "\\" + filenameLua + ".gz");
    count++;
  } while (indexKeyword != -1);

  console.log(count, "agent");
}

//圧縮
async function do_gzip(input, output) {
  const gzip = createGzip();
  const source = fs.createReadStream(input);
  const destination = fs.createWriteStream(output);
  await pipe(source, gzip, destination);
}

//エージェントデータ取得
getAgentData();
