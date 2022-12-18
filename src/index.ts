import * as fs from "fs";
import { Msg } from "./util/msg";
import { CheckEarthquake } from "./CheckEarthquake";
const { parse } = require("jsonc-parser");
const config = (() => {
    const json = fs.readFileSync("./config/config.json");
    return parse(json.toString());
})();
const bodyParser = require('body-parser');
const port = process.env.PORT || config.serverPort || 36578;
const KmoniTestDataPort = process.env.PORT || config.Kmoni.TestDataPort || 36579;
const wsPort = process.env.PORT || config.websocketPort || 3000;
const package_json = require('../package.json');
const isProxy = Boolean(process.env.IS_PROXY) || config.isPorxy || false;
const express = require('express');
const app = express();
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
let authCookie = "", userData = {};

const Login = async () => {
    await fetch("https://api.vrchat.cloud/api/1/auth/user", {
        headers: {
            credentials: "same-origin",
            Authorization: 'Basic ' + Buffer.from(encodeURIComponent(config.authentication.email) + ":" + encodeURIComponent(config.authentication.password)).toString("base64")
        },
    }).then((r) => {
        if (r.status == 200) {
            fs.writeFileSync("secret/authCookie.txt", r.headers.get("Set-Cookie").match(/auth=(.*?);/)[1]);
            isLogin = true;
            return r.json();
        }
    }).then((json) => {
        userData = json;
    }).catch((e) => {
    });
}

const Notice = async (title, body, isNotice = false) => {
    if (!isLogin) {
        console.log("ReLogin");
        await Login();
        if (!isLogin) {
            console.log("Cancel");
            return;
        }
    }
    console.log("Sending VRChat server....");
    await fetch("https://vrchat.com/api/1/groups/" + config.groupId + "/announcement", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: "auth=" + authCookie,
        },
        body: JSON.stringify({
            text: body,
            title: title,
            imageId: null,
            sendNotification: isNotice
        })
    }).then((r) => {
        // console.log("["+r.status+"] "+r.statusText);
        if (r.status == 200) {
            return r.json();
        }
    }).then((json) => {
        // console.log(json);
    }).catch((e) => {
        isLogin = false;
        console.log(e);
    });
}


const Main = async () => {

    if (fs.existsSync("secret/authCookie.txt")) {
        authCookie = fs.readFileSync("secret/authCookie.txt", "utf-8");
    }

    // ログイン確認
    await fetch("https://api.vrchat.cloud/api/1/auth/user", {
        headers: {
            Cookie: "auth=" + authCookie
        }
    }).then((r) => {
        if (r.status == 200) {
            isLogin = true;
            return r.json();
        }
    }).then((json) => {
        userData = json;
    }).catch((e) => {
        console.log(e);
    });;

    console.log("Login check: " + Msg.YesNo(isLogin));

    if (!isLogin) {
        await Login();
    }

    if (!isLogin) {
        console.log("Login failed...");
    } else {
        console.log("Login Success!");
    }

    const timer = new CheckEarthquake(Notice);
    timer.Start();

    router.post(endpoint, (req, res) => {
        // console.log(req.body);
        req.body.is_training = true;
        timer.DataProcess(req.body);
        return res.send("ok...");
    });

    timer.WebAPI(router);

    app.use(express.static('public'));

    app.use("/js", express.static('./build/public'));

    app.use(router);

    app.listen(KmoniTestDataPort, function () {
        console.log("試験データ待受ポート: " + KmoniTestDataPort);
    });

}

Main();