export type LogLevel = "info" | "debug" | "warn" | "error";

export class Logger {
    
    private levelPriority = {
        "debug":0, "info":1, "warn":2, "error":3
    }

    private sender;
    public static level: LogLevel = "info";

    constructor(sender, level: LogLevel = "info") {
        this.sender = sender;
    }

    public info(obj) {
        this.log("info", obj);
    }

    public debug(obj) {
        this.log("debug", obj);
    }

    public warn(obj) {
        this.log("warn", obj);
    }

    public error(obj) {
        this.log("error", obj);
    }
    
    public log(level, obj) {
        if (this.levelPriority[Logger.level] > this.levelPriority[level]) return;
        let sender = this.sender;
        let nowTime = new Date().toLocaleDateString("ja-JP", {year: "numeric",month: "2-digit",
        day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"});
        if (sender != "") {
            sender = "[" + sender + "] ";
        }
        sender = `[${nowTime}] [${level.toUpperCase()}] ${sender}`;
        if ( typeof obj === "string" ) {
            console.log(sender+"%s", obj);
        } else if (typeof obj === "number") {
            if (Number.isInteger(obj)) {
                console.log(sender+"%i", obj);
            } else {
                console.log(sender+"%f", obj);
            }
        } else {
            console.log(sender+"%o", JSON.parse(JSON.stringify(obj)));
        }
    }

}