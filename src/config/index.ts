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
        },
        stadiamaps: {
            apiKey: string;
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
        isTrainningNotice: boolean;
        UpdateReason: boolean;
        defaultRoleId: string;
        intensityRoleIds: {
            [intensity: string]: string | string[]; // 強震モニタの震度に対応したロールID。複数指定する場合は配列で。
        },
        warningOnlyRoleId: string;
        
        regionRoles: {
            [regionCode: string]: {
                roleId: string;
                name: string;
            };
        }
    };
    features: {
        enableLegacyNotice: boolean;
        enableTsunamiAlert_VTSE41: boolean;
    }
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