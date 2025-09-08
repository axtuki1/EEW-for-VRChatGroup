import * as fs from "fs";
import { clearInterval } from "timers";
import { CheckEarthquake } from "./CheckEarthquake";
const { parse } = require("jsonc-parser");
const config = (() => {
    const json = fs.readFileSync("./config/config.json");
    return parse(json.toString());
})();

export class CheckEarthquake_Kmoni extends CheckEarthquake {

    private intervalTimer: NodeJS.Timeout;
    private lastData;
    private lastRequestURL;
    private lastResponse;
    public intensityTable = {
        "1": 1,
        "2": 2,
        "3": 3,
        "4": 4,
        "5弱": 5,
        "5強": 6,
        "6弱": 7,
        "6強": 8,
        "7": 9,
    };
    public noticeIntensity = 4;
    public noticeIntensityForSupporter = 3;

    public constructor(callback: Function) {
        super(callback);
        this.lastData = {
            report_id: "",
            report_num: "",
            is_final: false,
            is_cancel: false,
            calcintensity: "1"
        }
    }
    public Start() {
        if (this.intensityTable[config.settings.noticeIntensity] !== undefined) {
            this.noticeIntensity = this.intensityTable[config.settings.noticeIntensity];
        }
        if (this.intensityTable[config.settings.noticeIntensityForSupporter] !== undefined) {
            this.noticeIntensityForSupporter = this.intensityTable[config.settings.noticeIntensityForSupporter];
        }
        const URL = config.Kmoni.DataURL;
        this.intervalTimer = setInterval(async () => {
            const nowDate = new Date();
            nowDate.setSeconds(nowDate.getSeconds() - 2);
            const currentURL = URL.replace(
                '${timestamp}',
                "" + nowDate.getFullYear() + (nowDate.getMonth() + 1).toString().padStart(2, "0") + nowDate.getDate().toString().padStart(2, "0") +
                nowDate.getHours().toString().padStart(2, "0") + nowDate.getMinutes().toString().padStart(2, "0") + (nowDate.getSeconds()).toString().padStart(2, "0")
            );
            this.lastRequestURL = currentURL;
            try {
                const response = await fetch(currentURL).then(r => r.json()).then(json => json);
                this.DataProcess(response);
            } catch (error) {
                console.log("接続エラー: ");
                console.log(error);
            }
        }, config.Kmoni.Timeout * 1000);
    }
    public Stop() {
        clearInterval(this.intervalTimer);
    }
    public DataProcess(data) {
        this.lastResponse = data;
        let update = false, reason = "";
        // 支援者向け？
        let isSupporter = false;
        if (
            this.intensityTable[data.calcintensity] < this.noticeIntensity &&
            this.intensityTable[data.calcintensity] < this.noticeIntensityForSupporter &&
            Number(this.lastData.report_id) != Number(data.report_id)
        ) {
            return;
        }
        if (
            Number(this.lastData.report_id) != Number(data.report_id)
        ) {
            reason = "前回と違うID";
            update = true;
        }
        if (!this.lastData.is_final && Boolean(this.lastData.is_final) != Boolean(data.is_final)) {
            reason = "最終報";
            update = true;
        }
        if (!this.lastData.is_cancel && Boolean(this.lastData.is_cancel) != Boolean(data.is_cancel)) {
            reason = "キャンセル";
            update = true;
        }

        let roleIds = [];
        // 支援者判定
        if (
            // 新規のIDの場合
            Number(this.lastData.report_id) != Number(data.report_id)
        ) {
            // 震度判定をする
            if (
                this.noticeIntensityForSupporter <= this.intensityTable[data.calcintensity] && // 支援者向け通知しきい値以上の震度 かつ
                this.intensityTable[data.calcintensity] < this.noticeIntensity // 震度が通常通知しきい値未満
            ) {
                roleIds = config.supporterRoleIds;
                isSupporter = true;
            } else {
                // 通常通知
                roleIds = config.roleIds;
                isSupporter = false;
            }
        } else {
            // 前回のIDと同じ場合
            // 通知済なので通常通知に繰り上げるか判定する

            // 前回のデータが支援者向け通知だった場合
            if (this.lastData.isSupporter) {
                if (this.intensityTable[data.calcintensity] < this.noticeIntensity) {
                    roleIds = config.supporterRoleIds;
                    isSupporter = true;
                }
            } else {
                // 前回が全体通知の場合、今回も全体通知とする
                isSupporter = false;
            }
        }

        if (update && data.report_id != "") {
            this.lastData = {
                report_id: data.report_id,
                report_num: data.report_num,
                is_final: data.is_final,
                is_cancel: data.is_cancel,
                calcintensity: data.calcintensity,
                isSupporter: isSupporter
            };
            console.log("データ受信: [" + data.alertflg + "] " + data.report_id + " Scale: " + data.calcintensity + " ReportNum: " + data.report_num + " isFinal: " + data.is_final + " isCancel: " + data.is_cancel + " is_training: " + data.is_training + " isSupporter: " + isSupporter);
            if (config.settings.UpdateReason) console.log("  - " + reason);
            this.SendData(data, roleIds);
        }
    }

    public SendData(data, roleIds = []) {
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
        this.callback(config.settings.sendTitle, sendMsg, true, roleIds);
    }
    public WebAPI(router) {
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
            let roleIds = [];
            if (
                this.intensityTable[data.calcintensity] < this.noticeIntensity
            ) {
                roleIds = config.supporterRoleIds;
            }
            this.SendData(data, roleIds);
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