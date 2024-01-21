import * as fs from "fs";
import { clearInterval } from "timers";
import { CheckEarthquake } from "./CheckEarthquake";
import { Logger } from "./util/logger";
const WebSocket = require("ws");
const { parse } = require("jsonc-parser");
const config = (() => {
    const json = fs.readFileSync("./config/config.json");
    return parse(json.toString());
})();

export class CheckEarthquake_P2P extends CheckEarthquake{

    private recvIds = [];
    private lastRequestURL;
    private lastResponse;
    private connection: WebSocket;
    private logger;
    public intensityTable = {
        "-1": 1,
         "0": 2,
        "10": 3,
        "20": 4,
        "30": 5,
        "40": 6,
        "50": 7,
        "55": 8,
        "60": 9,
        "65": 10,
        "70": 11,
    };
    public noticeIntensity = 6;
    public intensityNameMaster = {
       "-1": "不明",
       "0": "0",
       "10": "1",
       "20": "2",
       "30": "3",
       "40": "4",
       "50": "5弱",
       "55": "5強",
       "60": "6弱",
       "65": "6強",
       "70": "7",
    }
    
    private func = {
        551: (inputData) => { // JMAQuake 地震情報
            
        },
        556: (inputData) => { // EEW
            /**
             * {
             *   id: "情報を一意に識別するID",
             *   code: 556,
             *   time: "2006/01/02 15:04:05.999", // 受信日時
             *   test: true // テストかどうか,
             *   earthquake: {
             *     originTime: "地震発生時刻",
             *     arrivalTime: "地震発現時刻",
             *     condition: "", // 仮定震源要素の場合、値は "仮定震源要素"
             *     hypocenter: {
             *       name: "震央地名",
             *       reduceName: "短縮用震央地名",
             *       latitude: 0, // 緯度
             *       longitude: 0, // 経度
             *       depth: 10.0, // 深さ(km) 存在しない場合は-1 整数部のみ有効
             *       magnitude: 5.3 // マグニチュード 存在しない場合は-1
             *     }
             *   },
             *   issue: {
             *     time: "発表時刻",
             *     eventId: "識別情報",
             *     serial: "情報番号"
             *   },
             *   cancelled: false, // キャンセル報か
             *   area: [ // 細分区域 最大震度の情報あり
             *     {
             *       scaleFrom: 50, // 最大震度の下限
             *       scaleTo: 50 // 最大震度の上限
             *     }
             *   ]
             * }
             */
        }
    }

    public constructor(callback: Function) {
        super(callback);
        // this.lastData = {
        //     time: "",
        //     report_num: "",
        //     is_final: false,
        //     is_cancel: false,
        //     calcintensity: "1"
        // }
        this.logger = new Logger("P2P");
    }
    public connect() {
        if (this.connection != null && this.connection.readyState == 1) this.connection.close();
        this.lastRequestURL = config.P2P.DataURL;
        this.connection = new WebSocket(config.P2P.DataURL);
        this.connection.addEventListener("open", (e) => {
            this.logger.log("Connected!");
        });
        this.connection.addEventListener("message", (e) => {
            const data = JSON.parse(e.data);
            this.logger.log("Message received: code: " + data.code);
            this.lastResponse = data;
            this.DataProcess(data);
        });
        this.connection.addEventListener("close", (e) => {
            this.logger.log("Connection closed.");
        });
        this.connection.addEventListener("error", console.error);
    }
    public Start() {
        if (this.intensityTable[config.settings.noticeIntensity] !== undefined) {
            this.noticeIntensity = this.intensityTable[config.settings.noticeIntensity];
        }
        // 接続処理....
        this.logger.log("Connecting websocket server....");
        this.connect();
    }
    public Stop() {
        // 停止時処理...
        this.connection.close();
    }
    // データ処理 試験データもここに来るので...
    public DataProcess(data) {
        const func = this.func[data.code];
        if (func != null) func(data);
        // if (update && data.report_id != "") {
        //     this.lastData = {
        //         report_id: data.report_id,
        //         report_num: data.report_num,
        //         is_final: data.is_final,
        //         is_cancel: data.is_cancel,
        //         calcintensity: data.calcintensity
        //     };
        //     console.log("データ受信: [" + data.alertflg + "] " + data.report_id + " Scale: " + data.calcintensity + " ReportNum: " + data.report_num + " isFinal: " + data.is_final + " isCancel: " + data.is_cancel + " is_training: " + data.is_training);
        //     if(config.settings.UpdateReason) console.log("  - "+reason);
        //     this.SendData(data);
        // }
    }
    public SendData(data) {
        const origin_time = data.origin_time.replaceAll(/([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})/g, "$1年$2月$3日 $4:$5:$6");
        let sendMsg = config.settings.sendMsg;
        sendMsg = sendMsg.replaceAll("${isTraining}", data.is_training ? "--訓練-- " : "");
        sendMsg = sendMsg.replaceAll("${alertFlg}", data.alertflg == "警報" ? "!警報! " : "");
        sendMsg = sendMsg.replaceAll(
            "${report_num}",
            data.is_cancel ? "キャンセル" : (
                data.is_final ? "最終報" : "第" + data.report_num + "報"
            )
        );
        sendMsg = sendMsg.replaceAll("${region_name}", data.region_name);
        sendMsg = sendMsg.replaceAll("${intensity}", data.calcintensity);
        sendMsg = sendMsg.replaceAll("${magunitude}", data.magunitude);
        sendMsg = sendMsg.replaceAll("${depth}", data.depth);
        sendMsg = sendMsg.replaceAll("${origin_time}", origin_time);
        this.callback(config.settings.sendTitle,sendMsg,true);
    }
    public WebAPI(router) {
        router.get("/api/v1/reconnect", (req, res) => {
            this.connect();
            res.json({
                status: "ok"
            });
        });
        router.get("/api/v1/lastResponse", (req, res) => {
            res.json({
                requestURL: this.lastRequestURL,
                response: this.lastResponse
            });
        });
        router.post("/api/v1/testDataInput", (req, res) => {
            const data = req.body;
            data.is_training = true;
            data.region_name = "[試験データ]" + data.region_name;
            this.SendData(data);
            res.json({
                status: "ok"
            });
        });
        router.get("/api/v1/testAnnounce", async (req, res) => {
            await this.callback(
                "試験放送",
                "こちらはテスト用のメッセージです。"
            )
            res.json({
                "result": "ok"
            });
        });
    }

    
}