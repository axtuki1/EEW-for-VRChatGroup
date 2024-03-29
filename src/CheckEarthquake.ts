import * as fs from "fs";
import { clearInterval } from "timers";
const { parse } = require("jsonc-parser");
const config = (() => {
    const json = fs.readFileSync("./config/config.json");
    return parse(json.toString());
})();

export class CheckEarthquake {

    private intervalTimer: NodeJS.Timeout;
    private callback: Function;
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

    public constructor(callback: Function) {
        this.callback = callback;
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
                console.log("接続エラー: "+error);
            }
        }, config.Kmoni.Timeout * 1000);
    }
    public Cancel() {
        clearInterval(this.intervalTimer);
    }
    public DataProcess(data) {
        this.lastResponse = data;
        let update = false, reason = "";
        if (this.intensityTable[data.calcintensity] < this.noticeIntensity && Number(this.lastData.report_id) != Number(data.report_id)) {
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
        if (update && data.report_id != "") {
            this.lastData = {
                report_id: data.report_id,
                report_num: data.report_num,
                is_final: data.is_final,
                is_cancel: data.is_cancel,
                calcintensity: data.calcintensity
            };
            console.log("データ受信: [" + data.alertflg + "] " + data.report_id + " Scale: " + data.calcintensity + " ReportNum: " + data.report_num + " isFinal: " + data.is_final + " isCancel: " + data.is_cancel + " is_training: " + data.is_training);
            if(config.Kmoni.UpdateReason) console.log("  - "+reason);
            this.SendData(data);
        }
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