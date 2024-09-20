import * as fs from "fs";
import { clearInterval } from "timers";
import { CheckEarthquake } from "./CheckEarthquake";
import { Logger } from "./util/logger";
import rndstr from "rndstr";
import { DMDATA } from "./dmdata/DMDATA";
const WebSocket = require("ws");
const zlib = require("zlib");
const expressWs = require('express-ws');
const { parse } = require("jsonc-parser");
const config = (() => {
    const json = fs.readFileSync("./config/config.json");
    return parse(json.toString());
})();

export class CheckEarthquake_DMDATA extends CheckEarthquake {

    private recvIds = [];
    private lastRequestURL;
    private lastResponse;
    private lastPing;
    private logger: Logger;
    private dmdata: DMDATA;
    private isReconnect = true;
    public intensityTable = {
        "不明": 1,
        "0": 2,
        "1": 3,
        "2": 4,
        "3": 5,
        "4": 6,
        "5+": 7,
        "5-": 8,
        "6-": 9,
        "6+": 10,
        "7": 11,
        "over": 12,
    };
    public noticeIntensity = 6;
    public intensityNameMaster = {
        "不明": "不明",
        "0": "0",
        "1": "1",
        "2": "2",
        "3": "3",
        "4": "4",
        "5-": "5弱",
        "5+": "5強",
        "6-": "6弱",
        "6+": "6強",
        "7": "7",
        "over": "7",
    }
    private retryCount = 0;
    private currentTicket;

    private func = {
        "VXSE45": (data, xmlData) => {
            this.SendData(xmlData);
        }
    }

    public constructor(callback: Function) {
        super(callback);
        this.logger = new Logger("DMDATA");
    }

    public async connect() {

        if (this.currentTicket != null) {
            this.dmdata.closeConnect(this.currentTicket);
            this.dmdata.closeTicket(this.currentTicket);
        }

        this.logger.info("Creating ticket...");
        const ticket = await this.dmdata.createTicket(
            "EEWForVRChatGroup",
            [
                DMDATA.Ticket.Classification.EEW.Forecast,
                DMDATA.Ticket.Classification.Telegram.Earthquake
            ],
            [
                "VXSE44", // 緊急地震速報（予報）
                "VXSE45", // 緊急地震速報（地震動予報）
                // "VXSE51", // 震度速報
                // "VTSE41", // 津波警報・注意報・予報
                // "VXSE52", // 震源に関する情報
                // "VXSE53"  // 震源・震度に関する情報
            ],
            "json",
            true
        );

        if (ticket.error) {
            this.logger.info("Failed to create ticket:");
            this.logger.info(ticket.error);
            this.Stop();
            return;
        }
        this.logger.info("Ticket created: " + ticket.responseId);
        this.logger.info("Connecting to websocket server...");
        this.dmdata.startConnect(ticket);
        this.currentTicket = ticket;
    }
    public Start() {
        if (this.intensityTable[config.settings.noticeIntensity] !== undefined) {
            this.noticeIntensity = this.intensityTable[config.settings.noticeIntensity];
        }
        // 接続処理....

        this.dmdata = new DMDATA(config.DMDATA.APIKey);
        this.dmdata.addEventListener("open", () => {
            this.logger.info("Connected to DMDATA!");
        });
        this.dmdata.addEventListener("ping", (error) => {
            this.lastPing = new Date();
        });
        this.dmdata.addEventListener("error", (error) => {
            this.logger.info(error);
            if (this.isReconnect) {
                this.logger.info("Reconnecting...");
                this.connect();
            }

        });
        this.dmdata.addEventListener("close", () => {
            this.logger.info("Disconnected from DMDATA!");
            if (this.isReconnect) {
                this.logger.info("Reconnecting...");
                this.connect();
            }
        });
        this.dmdata.addEventListener("receive", (data) => {
            this.lastResponse = data;
            if (data.body != null) {
                // gzip圧縮されているデータを解凍
                data.body = JSON.parse(zlib.gunzipSync(Buffer.from(data.body, 'base64')).toString('utf-8'));
            }
            this.DataProcess(data);
        });

        this.connect();

    }
    public Stop() {
        // 停止時処理...
        this.isReconnect = false;
        this.dmdata.closeConnect(this.currentTicket);
        this.currentTicket = null;
    }
    // データ処理 試験データもここに来るので...
    public DataProcess(data) {
        if (data.type == "data") {
            const func = this.func[data.head.type];
            if (func != null) func(data, data.body);
        }
        if (config.gatherData) {
            let nowTime = new Date().toLocaleDateString("ja-JP", {
                year: "numeric", month: "2-digit",
                day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
            });

            console.log("Data received: " + nowTime);

            if (!fs.existsSync("secret/gather")) {
                fs.mkdirSync("secret/gather");
            }
            let time = nowTime.replace(/([0-9]{4})\/([0-9]{2})\/([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})/g, "$1-$2-$3_$4-$5-$6");
            fs.writeFileSync(`secret/gather/${time}-${rndstr("0123456789", 4)}.json`, JSON.stringify(data, null, 3));
        }
    }

    /*
    {
        is_training: false,
        alertflg: "予報", // 緊急地震速報（警報）発報時に"警報"
        report_num: 1,
        region_name: "東京都南部",
        calcintensity: "30",
        magunitude: "3.9",
        depth: "40",
        origin_time: "20210616102424"
    }
    */
    private lastData = {};
    private knownData = {};
    public SendData(xmlData, notice:boolean = true) {
        if (
            xmlData.body.earthquake.condition == "仮定震源要素時" ||
            xmlData.body.intensity == null
        ) {
            // 仮定震源要素時は無視
            // 震度情報がない場合も無視
            return;
        }
        // 通知対象の震度か確認
        if (this.intensityTable[xmlData.body.intensity.forecastMaxInt.to] < this.noticeIntensity) {
            return;
        }

        // 配信済みのデータで、以下の条件に当てはまらない場合は無視 (配信する理由が条件に入る)
        // 最終報である
        // キャンセル情報である
        // 既存のデータよりも強い震度情報である
        if (
            xmlData.eventId in this.knownData && !(
                xmlData.body.isLastInfo ||
                xmlData.body.isCanceled ||
                this.intensityTable[this.knownData[xmlData.eventId].body.intensity.forecastMaxInt.to] < this.intensityTable[xmlData.body.intensity.forecastMaxInt.to]
            )
        ) {
            return;
        }

        this.knownData[xmlData.eventId] = xmlData;
        this.scheduleRemoveOldKnownData(xmlData.eventId);

        let data: any = {
            is_training: xmlData.body.isTraining,
            is_final: xmlData.body.isLastInfo,
            is_cancel: xmlData.body.isCanceled,
            alertflg: xmlData.body.isWarning ? "警報" : "予報", // 緊急地震速報（警報）発報時に"警報"
            report_num: xmlData.serialNo,
            region_name: xmlData.body.earthquake.hypocenter.name,
            calcintensity: this.intensityNameMaster[xmlData.body.intensity.forecastMaxInt.to],
            magunitude: xmlData.body.earthquake.magnitude.value ? xmlData.body.earthquake.magnitude.value : "不明",
            depth: xmlData.body.earthquake.hypocenter.depth.value + xmlData.body.earthquake.hypocenter.depth.unit,
            origin_time: xmlData.body.earthquake.originTime
        };
        const origin_time_obj = new Date(xmlData.body.earthquake.originTime);
        const origin_time = `${origin_time_obj.getFullYear()}年${origin_time_obj.getMonth() + 1}月${origin_time_obj.getDate()}日 ${origin_time_obj.getHours()}:${origin_time_obj.getMinutes()}:${origin_time_obj.getSeconds()}`;
        let sendMsg = config.DMDATA.sendMsg;
        if (data.is_cancel) {
            sendMsg = config.DMDATA.cancelMsg;
            data = this.lastData;
        } else {
            this.lastData = data;
        }

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
        this.callback(config.settings.sendTitle, sendMsg, notice);
    }

    // 旧データの削除処理
    private scheduleTimeouts = {};
    public scheduleRemoveOldKnownData(eventId) {
        if (eventId in this.scheduleTimeouts) {
            clearTimeout(this.scheduleTimeouts[eventId]);
        }
        this.scheduleTimeouts[eventId] = setTimeout(() => {
            delete this.knownData[eventId];
            delete this.scheduleTimeouts[eventId];
        }, 1000 * 60 * 60); // 1時間後に削除
    }

    public WebAPI(router) {
        expressWs(router);
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
        router.get("/api/v1/debug", (req, res) => {
            res.json({
                allTickets: this.dmdata.getTickets(),
                lastPing: this.dmdata.getLastPing(this.currentTicket),
                
            });
        });
        router.post("/api/v1/testDataInput", (req, res) => {
            const data = req.body;
            data.body.body.isTraining = true;
            data.body.body.earthquake.hypocenter.name = "[試験データ]" + data.body.body.earthquake.hypocenter.name;
            this.SendData(data.body, false);
            res.json({
                status: "ok"
            });
        });
        router.post("/api/v1/gunziptest", (req, res) => {
            const data = req.body;
            data.body = JSON.parse(zlib.gunzipSync(Buffer.from(data.body, 'base64')).toString('utf-8'));
            res.json({
                status: "ok",
                result: data
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
        router.ws("/api/v1/ws", (ws, req) => {
            this.logger.info("Local websocket server connected!");

            ws.on("message", (message) => {
                const data = JSON.parse(message);
                if (data.type === "send") {
                    this.SendData(data.data);
                }
            });
        });
    }


}