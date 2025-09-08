export class Logger {
    
    private levelPriority = {
        "debug":0, "info":1, "warn":2, "error":3
    }

    private sender;
    private level: "info" | "debug" | "warn" | "error" = "info";

    constructor(sender, level: "info" | "debug" | "warn" | "error" = "info") {
        this.sender = sender;
        this.level = level;
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
        if (this.levelPriority[this.level] > this.levelPriority[level]) return;
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