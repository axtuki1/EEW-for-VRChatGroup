import * as fs from "fs";
import { clearInterval } from "timers";
import { CheckEarthquake } from "./CheckEarthquake";
import { Logger } from "./util/logger";
import rndstr from "rndstr";
import { DMDATA } from "./dmdata/DMDATA";
import { Config } from "./config";
const WebSocket = require("ws");
const zlib = require("zlib");
const expressWs = require('express-ws');
const { parse } = require("jsonc-parser");

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
        // "over": 12, // overはfromの値を見るので...
    };
    public noticeIntensity = 6;
    public noticeIntensityForSupporter = 5;
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
        "over": "over", // overはfromの値を見るので...
    }
    private retryCount = 0;
    private currentTicket;

    private func = {
        "VXSE45": (data, xmlData) => {
            try {
                this.SendData(xmlData);
            } catch (e) {
                this.logger.error("受信時処理でエラーが発生しました:");
                console.log(e);
            }
        }
    }

    public constructor(callback: Function) {
        super(callback);
        this.logger = new Logger("DMDATA");
        const config = Config.get();
        if (this.intensityTable[config.settings.noticeIntensity] !== undefined) {
            this.noticeIntensity = this.intensityTable[config.settings.noticeIntensity];
        }
        if (this.intensityTable[config.settings.noticeIntensityForSupporter] !== undefined) {
            this.noticeIntensityForSupporter = this.intensityTable[config.settings.noticeIntensityForSupporter];
        }
    }

    public Start() {
        const config = Config.get();

        // 接続処理....

        this.dmdata = new DMDATA(config.DMDATA.APIKey);
        this.dmdata.addEventListener("open", () => {
            this.logger.info("Connected to DMDATA!: " + this.currentTicket.websocket.id);
        });
        this.dmdata.addEventListener("ping", (error) => {
            this.lastPing = new Date();
        });
        this.dmdata.addEventListener("error", (error) => {
            this.logger.error(error);
        });
        this.dmdata.addEventListener("close", () => {
            this.currentTicket = null;
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

    public async connect() {

        if (this.currentTicket != null) {
            this.dmdata.closeConnect(this.currentTicket);
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
            false // テスト報の受けとり
        );

        if (ticket.error) {
            // チケット作成に失敗したときは指定秒数待って再接続
            this.logger.error("Failed to create ticket:");
            this.logger.error(ticket.error);
            if (this.retryCount < Config.get().DMDATA.MaxTryConnectCount) {
                setTimeout(() => {
                    this.connect();
                }, Config.get().DMDATA.NextReconnectDelay * 1000);
                this.retryCount++;
            } else {
                this.logger.error("Reached max retry count. Stop reconnecting.");
                this.Stop();
            }
            return;
        }
        if (ticket.responseId === null || ticket.responseId === undefined) {
            // そんなことはないので、再トライ
            this.logger.error("Failed to create ticket: No response ID");
            if (this.retryCount < Config.get().DMDATA.MaxTryConnectCount) {
                setTimeout(() => {
                    this.connect();
                }, Config.get().DMDATA.NextReconnectDelay * 1000);
                this.retryCount++;
            } else {
                this.logger.error("Reached max retry count. Stop reconnecting.");
                this.Stop();
            }
            return;
        }
        this.logger.info("Ticket created: " + ticket.responseId);
        this.logger.info("Connecting to websocket server...");
        this.dmdata.startConnect(ticket);
        this.currentTicket = ticket;
    }

    // データ処理 試験データもここに来るので...
    public DataProcess(data) {
        if (data.type == "data") {
            const func = this.func[data.head.type];
            if (func != null) func(data, data.body);
        }
        if (Config.get().gatherData) {
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
    public SendData(xmlData, notice: boolean = true) {

        const config = Config.get();

        // 支援者向けであるか
        let isSupporter = false;
        // 配信する役職ID
        let roleIds = [];

        // === 配信条件の判定 ===

        if (
            xmlData.body.earthquake?.condition == "仮定震源要素時"
        ) {
            // 仮定震源要素時は無条件で無視
            return;
        }

        const loggerPrefix = "[" + xmlData.eventId + "] ";

        this.logger.debug(loggerPrefix + "電文受信");

        const isTraining = xmlData.status != "通常";
        // 試験/訓練データ
        if (
            isTraining && !config.settings.isTrainningNotice
        ) {
            this.logger.info(loggerPrefix + "試験/訓練データのため無視");
            return;
        }

        // 新データ震度 undefinedの場合は下記条件でrejectされるはずなので早期に求めてもよい...はず
        let newintensity = xmlData.body?.intensity?.forecastMaxInt?.to;
        let isOver = false;
        this.logger.debug(loggerPrefix + "新データ震度(以上): " + newintensity);
        if (newintensity == "over") { // ～以上の場合はfromをとる
            newintensity = xmlData.body?.intensity?.forecastMaxInt?.from;
            isOver = true;
            this.logger.debug(loggerPrefix + "overのためfromから取得");
            this.logger.debug(loggerPrefix + "新データ震度(以下): " + newintensity);
        }

        if (xmlData.eventId in this.knownData) {
            this.logger.debug(loggerPrefix + "配信済みのイベント? : yes");

            // 配信済みのデータで、以下の条件に当てはまらない場合は無視 (配信する理由が条件に入る)
            // 最終報である
            // キャンセル情報である
            // 既存のデータよりも強い震度情報である

            // 既存データ震度
            let oldintensity = this.knownData[xmlData.eventId].body?.intensity?.forecastMaxInt?.to;
            this.logger.debug(loggerPrefix + "旧データ震度(以上): " + oldintensity);
            if (oldintensity == "over") { // ～以上の場合はfromをとる
                oldintensity = this.knownData[xmlData.eventId].body?.intensity?.forecastMaxInt?.from;
                this.logger.debug(loggerPrefix + "overなのでfromから取得");
                this.logger.debug(loggerPrefix + "旧データ震度(以下): " + oldintensity);
            }

            this.logger.debug(loggerPrefix + "配信条件確認");
            this.logger.debug(loggerPrefix + "最終報(isLastInfo): " + xmlData.body.isLastInfo);
            this.logger.debug(loggerPrefix + "キャンセル報(isCanceled): " + xmlData.body.isCanceled);
            this.logger.debug(loggerPrefix + "震度比較: " + this.intensityTable[newintensity] + " > " + this.intensityTable[oldintensity]);
            if (!(
                xmlData.body.isLastInfo ||
                xmlData.body.isCanceled ||
                this.intensityTable[newintensity] > this.intensityTable[oldintensity]
            )) {
                this.logger.debug(loggerPrefix + "どの条件にもヒットしない");
                return;
            }
        } else {
            this.logger.debug(loggerPrefix + "配信済みのイベント? : no");
            this.logger.debug(loggerPrefix + "配信条件確認");
            this.logger.debug(loggerPrefix + "全体通知しきい値: " + this.intensityTable[newintensity] + " < " + this.noticeIntensity);
            this.logger.debug(loggerPrefix + "支援者通知しきい値: " + this.intensityTable[newintensity] + " < " + this.noticeIntensityForSupporter);
            // 未配信データの場合
            if (!xmlData.body.isCanceled &&
                (
                    xmlData.body.intensity == null ||
                    this.intensityTable[newintensity] < this.noticeIntensity &&
                    this.intensityTable[newintensity] < this.noticeIntensityForSupporter
                )) {
                    this.logger.debug(loggerPrefix + "どの条件にもヒットしない");
                return;
            }
        }

        // === 配信済みリストに登録 ===

        // キャンセル報の場合、既存のデータを取得してキャンセル情報を付与
        if (xmlData.body.isCanceled) {
            xmlData = this.knownData[xmlData.eventId];
            xmlData.body.isCanceled = true;
        } else {
            // 通知対象の震度である場合、新しいデータを保存
            this.knownData[xmlData.eventId] = xmlData;
        }
        this.scheduleRemoveOldKnownData(xmlData.eventId);

        // === 配信対象決定 ===

        // ここまででxmlDataとthis.knownData[xmlData.eventId]はisSupporter除き同一のはず

        // 記録されたデータに支援者情報がない場合は新規として扱う

        if (this.knownData[xmlData.eventId].isSupporter === undefined) {
            this.logger.debug("新規データを受信: " + xmlData.eventId);
            // とりあえず書き込みはしておく
            this.knownData[xmlData.eventId].isSupporter = false;
            // 新規なので、普通に震度判定を行う
            this.logger.debug(loggerPrefix + "震度判定: " + newintensity);
            this.logger.debug(loggerPrefix + "震度判定値: " + this.intensityTable[newintensity]);
            this.logger.debug(loggerPrefix + "通常通知しきい値: " + this.noticeIntensity);
            this.logger.debug(loggerPrefix + "支援者向け通知しきい値: " + this.noticeIntensityForSupporter);
            if (
                this.noticeIntensityForSupporter <= this.intensityTable[newintensity] && // 支援者向け通知しきい値以上の震度 かつ
                this.intensityTable[newintensity] < this.noticeIntensity // 震度が通常通知しきい値未満
            ) {
                roleIds = config.supporterRoleIds;
                isSupporter = true;
            } else {
                // 通常通知
                roleIds = [];
                isSupporter = false;
            }
            this.logger.debug(loggerPrefix + "支援者向け: " + isSupporter);
            this.logger.debug(loggerPrefix + "配信ロールID: " + roleIds);
        } else {
            this.logger.debug(loggerPrefix + "既存データ: " + xmlData.eventId);
            // 前回が支援者向け通知の場合、今回全体通知に繰り上げるか判定する
            // ※最終報などで震度が下がった場合でも拾えるように全体通知しきい値を超えていないかで判定
            if (this.knownData[xmlData.eventId].isSupporter) {
                if (this.intensityTable[newintensity] < this.noticeIntensity) {
                    roleIds = config.supporterRoleIds;
                    isSupporter = true;
                }
            } else {
                // 前回が全体通知の場合、今回も全体通知とする
                isSupporter = false;
            }
        }

        // === 配信データ作成 ===

        let data: any = {
            is_training: isTraining,
            is_final: xmlData.body.isLastInfo,
            is_cancel: xmlData.body.isCanceled,
            alertflg: xmlData.body.isWarning ? "警報" : "予報", // 緊急地震速報（警報）発報時に"警報"
            report_num: xmlData.serialNo,
            region_name: xmlData.body.earthquake.hypocenter.name,
            calcintensity: this.intensityNameMaster[newintensity] + (isOver ? "以上" : ""),
            magunitude: xmlData.body.earthquake.magnitude.value ? xmlData.body.earthquake.magnitude.value : "不明",
            depth: xmlData.body.earthquake.hypocenter.depth.value + xmlData.body.earthquake.hypocenter.depth.unit,
            origin_time: xmlData.body.earthquake.originTime
        };
        const origin_time_obj = new Date(xmlData.body.earthquake.originTime);
        const origin_time_year = origin_time_obj.getFullYear();
        const origin_time_month = (origin_time_obj.getMonth() + 1).toString().padStart(2, "0");
        const origin_time_day = origin_time_obj.getDate().toString().padStart(2, "0");
        const origin_time_hour = origin_time_obj.getHours().toString().padStart(2, "0");
        const origin_time_min = origin_time_obj.getMinutes().toString().padStart(2, "0");
        const origin_time_sec = origin_time_obj.getSeconds().toString().padStart(2, "0");
        const origin_time = `${origin_time_year}年${origin_time_month}月${origin_time_day}日 ${origin_time_hour}:${origin_time_min}:${origin_time_sec}`;
        let sendMsg: string = config.DMDATA.sendMsg;
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
        this.callback(config.settings.sendTitle, sendMsg, notice, roleIds);
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
        router.post("/api/v1/testDataInput", (req, res) => {
            const data = req.body;
            data.body.status = "試験";
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