import * as fs from "fs";
import { LogLevel } from "../util/logger";
const { parse } = require("jsonc-parser");

export class Config {

    apiKey: string;
    authentication: {
        email: string;
        password: string;
        OTP: {
            URI: string;
        }
    };
    groupId: string;
    supporterRoleIds: string[];
    DataSource: "DMDATA" | "Kmoni" | "P2P";
    P2P?: {
        NextReconnectDelay: number;
        MaxTryConnectCount: number;
        DataURL: string;
        EEWDetectData: {
            Title: string;
            Body: string;
            Popup: boolean;
        }
    };
    DMDATA?: {
        NextReconnectDelay: number;
        MaxTryConnectCount: number;
        APIKey: string;
        sendMsg: string;
        cancelMsg: string;
    };
    Kmoni?: {
        Timeout: number;
        DataURL: string;
    };
    TestDataPort: number;
    settings: {
        noticeIntensity: string;
        noticeIntensityForSupporter: string;
        sendTitle: string;
        sendMsg: string;
        UpdateReason: boolean;
    };
    OTPValue: string;
    contact: string;
    logLevel: LogLevel;
    gatherData?: boolean;
    debug?: boolean;

    constructor(params) {
        Object.assign(this, params);
    }

    static data: Config;
    static path: string = "./config/config.json";

    static load(path: string = Config.path): Config {
        if(Config.data && Config.path === path) {
            return Config.data;
        }
        const json = fs.readFileSync(path, "utf-8");
        const params = parse(json);
        Config.data = new Config(params);
        return Config.data;
    }

    static get(): Config {
        if(!Config.data) {
            Config.load();
        }
        return Config.data;
    }
}