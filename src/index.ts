import * as fs from "fs";
import { Msg } from "./util/msg";
import { CheckEarthquake_Kmoni } from "./CheckEarthquake_Kmoni";
import { CheckEarthquake_P2P } from "./CheckEarthquake_P2P";
import * as OTPAuth from "otpauth";
import { CheckEarthquake } from "./CheckEarthquake";
import { Logger } from "./util/logger";
const { parse } = require("jsonc-parser");
const config = (() => {
    const json = fs.readFileSync("./config/config.json");
    return parse(json.toString());
})();
const bodyParser = require('body-parser');
const port = process.env.PORT || config.serverPort || 36578;
const TestDataPort = process.env.PORT || config.TestDataPort || 36579;
const wsPort = process.env.PORT || config.websocketPort || 3000;
const package_json = require('../package.json');
const isProxy = Boolean(process.env.IS_PROXY) || config.isPorxy || false;
const express = require('express');
const app = express();
let server = null;
const endpoint = "/eewext";
const res = require('express/lib/response');

if (package_json.name == "template") {
    process.exit(1);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const router = express.Router();

console.log("///////////////////////////////////////////////");
console.log("       " + package_json.name + " v" + package_json.version);
console.log("///////////////////////////////////////////////");

if (!fs.existsSync("secret")) {
    fs.mkdirSync("secret");
}

let isLogin = false;
let authCookie = "", twoFactorAuth = "", userData = {};

const DEBUGLOG = (sender, value) => {
    if (!config.debug) return;
    console.log("[" + sender + "]--------");
    console.log(value);
}

let totpObj: OTPAuth.TOTP | OTPAuth.HOTP = null;

if (config.authentication.OTP != null && config.authentication.OTP.URI != null) {
    totpObj = OTPAuth.URI.parse(config.authentication.OTP.URI);
}


const Login = async () => {
    let logger = new Logger("API:Login");
    let isTwoFactorAuth = false, otpType = [];
    await fetch("https://api.vrchat.cloud/api/1/auth/user", {
        headers: {
            "Content-Type": "application/json",
            "Cookie": "apiKey=" + config.apiKey,
            credentials: "same-origin",
            Authorization: 'Basic ' + Buffer.from(encodeURIComponent(config.authentication.email) + ":" + encodeURIComponent(config.authentication.password)).toString("base64")
        },
    }).then((r) => {
        DEBUGLOG("Login, user header", r);
        if (r.status == 200) {
            authCookie = r.headers.get("Set-Cookie").match(/auth=(.*?);/)[1];
            fs.writeFileSync("secret/authCookie.txt", authCookie);
            isLogin = true;
            return r.json();
        }
    }).then((json) => {
        DEBUGLOG("Login, user", json);
        if (json.requiresTwoFactorAuth) {
            isLogin = false;
            isTwoFactorAuth = true;
            otpType = json.requiresTwoFactorAuth;
            logger.log("Requires TwoFactorAuth");
            return;
        }
        userData = json;
    }).catch((e) => {
    });
    if (isTwoFactorAuth) {
        for (let i = 0; i < otpType.length; i++) {
            // OTP 汚いので書き直したい。
            let token = config.OTPValue;
            if (totpObj != null && otpType[i] == "totp") {
                token = totpObj.generate();
            }
            logger.log("Try auth: " + otpType[i] + " / " + token);
            await fetch("https://api.vrchat.cloud/api/1/auth/twofactorauth/" + otpType[i] + "/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Cookie": "apiKey=" + config.apiKey + "; auth=" + authCookie + "; twoFactorAuth=" + twoFactorAuth
                },
                body: JSON.stringify({
                    "code": token
                })
            }).then((r) => {
                DEBUGLOG("Login, otp header", r);
                if (r.status == 200) {
                    isLogin = true;
                    twoFactorAuth = r.headers.get("Set-Cookie").match(/twoFactorAuth=(.*?);/)[1];
                    fs.writeFileSync("secret/twoFactorAuth.txt", twoFactorAuth);
                    return r.json();
                }
                return r.json();
            }).then((json) => {
                if (json == undefined || json.length == 0) return;
                DEBUGLOG("Login, otp", json);
                if (json.requiresTwoFactorAuth) {
                    isLogin = false;
                    logger.log("TwoFactorAuth failed...");
                    return;
                }
                userData = json;
            }).catch((e) => {
                logger.log(e);
            });
            if (isLogin) break;
        }
    }
}

const GetPostList = async () => {
    let logger = new Logger("API:PostList");
    if (!isLogin) {
        logger.log("ReLogin");
        await Login();
        if (!isLogin) {
            logger.log("Cancel");
            return;
        }
    }
    logger.log("GetPostList....");
    return await fetch("https://vrchat.com/api/1/groups/" + config.groupId + "/posts?n=15&offset=0", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": package_json.name + "/v" + package_json.version + " " + package_json.github + " " + config.contact,
            Cookie: "apiKey=" + config.apiKey + "; auth=" + authCookie + "; twoFactorAuth=" + twoFactorAuth
        },
        body: null
    }).then((r) => {
        if (config.debug) logger.log("[" + r.status + "] " + r.statusText);
        if (r.status == 200) {
            return r.json();
        }
    }).catch((e) => {
        isLogin = false;
        logger.log(e);
    });
}

const PostRemove = async (postId) => {
    let logger = new Logger("API:PostRemove");
    if (!isLogin) {
        logger.log("ReLogin");
        await Login();
        if (!isLogin) {
            console.log("Cancel");
            return;
        }
    }
    logger.log("PostRemoving...");
    return await fetch("https://vrchat.com/api/1/groups/" + config.groupId + "/posts/"+postId, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": package_json.name + "/v" + package_json.version + " " + package_json.github + " " + config.contact,
            Cookie: "apiKey=" + config.apiKey + "; auth=" + authCookie + "; twoFactorAuth=" + twoFactorAuth
        },
        body: null
    }).then((r) => {
        if (config.debug) logger.log("[" + r.status + "] " + r.statusText);
        if (r.status == 200) {
            return r.json();
        }
    }).then((json) => {
        if (config.debug) logger.log(json);
    }).catch((e) => {
        isLogin = false;
        logger.log(e);
    });
}

const Notice = async (title, body, isNotice = false) => {
    let logger = new Logger("API:Notice");
    if (!isLogin) {
        logger.log("ReLogin");
        await Login();
        if (!isLogin) {
            logger.log("Cancel");
            return;
        }
    }
    logger.log("Sending VRChat server....");
    await fetch("https://vrchat.com/api/1/groups/" + config.groupId + "/posts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": package_json.name + "/v" + package_json.version + " " + package_json.github + " " + config.contact,
            Cookie: "apiKey=" + config.apiKey + "; auth=" + authCookie + "; twoFactorAuth=" + twoFactorAuth
        },
        body: JSON.stringify({
            text: body,
            title: title,
            imageId: null,
            sendNotification: isNotice
        })
    }).then((r) => {
        if (config.debug) console.log("[" + r.status + "] " + r.statusText);
        if (r.status == 200) {
            return r.json();
        }
    }).then((json) => {
        if (config.debug) console.log(json);
    }).catch((e) => {
        isLogin = false;
        logger.log(e);
    });
}

const UpdatePost = async (title, body, isNotice = false) => {
    const alllist = GetPostList();
    const list = await alllist;
    if (config.debug) console.log(list);
    list["posts"].filter((post) => post.title == title).forEach(async post => {
        await PostRemove(post.id);
    });
    Notice(title, body, isNotice);
}

const Main = async () => {
    
    let logger = new Logger("Main");

    if (fs.existsSync("secret/authCookie.txt")) {
        authCookie = fs.readFileSync("secret/authCookie.txt", "utf-8");
    }
    if (fs.existsSync("secret/twoFactorAuth.txt")) {
        twoFactorAuth = fs.readFileSync("secret/twoFactorAuth.txt", "utf-8");
    }

    // ログイン確認
    await fetch("https://api.vrchat.cloud/api/1/auth/user", {
        headers: {
            Cookie: "apiKey=" + config.apiKey + "; auth=" + authCookie + "; twoFactorAuth=" + twoFactorAuth
        }
    }).then((r) => {
        DEBUGLOG("Main, Cookiecheck header", r);
        if (r.status == 200) {
            isLogin = true;
            return r.json();
        }
    }).then((json) => {
        if (json == undefined) return;
        DEBUGLOG("Main, Cookiecheck", json);
        if (json.requiresTwoFactorAuth) {
            isLogin = false;
            return;
        }
        userData = json;
    }).catch((e) => {
        logger.log(e);
    });

    logger.log("Login check: " + Msg.YesNo(isLogin));

    if (!isLogin) {
        await Login();
    }

    if (!isLogin) {
        logger.log("Login failed...");
        if (!config.debug) return;
    } else {
        logger.log("Login Success!");
    }

    let timer: CheckEarthquake = null;
    if (config.DataSource == "Kmoni") {
        timer = new CheckEarthquake_Kmoni(UpdatePost);
    } else {
        timer = new CheckEarthquake_P2P(UpdatePost);
        
    }
    timer.Start();

    router.post(endpoint, (req, res) => {
        // console.log(req.body);
        req.body.is_training = true;
        timer.DataProcess(req.body);
        return res.send("ok...");
    });

    timer.WebAPI(router);

    process.on("SIGINT", function () {
        process.exit(0);
    });

    process.on("exit", function() {
        console.log("Exitting...");
        if (server != null) server.close(() => {
            console.log("web server closed.");
        });
    })

    app.use(express.static('public'));

    app.use("/js", express.static('./build/public'));

    app.use(router);

    server = app.listen(TestDataPort, function () {
        console.log("試験データ待受ポート: " + TestDataPort);
    });

}

Main();