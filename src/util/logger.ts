export class Logger {
    
    private sender;

    constructor(sender) {
        this.sender = sender;
    }
    
    public log(obj) {
        let sender = this.sender;
        let nowTime = new Date().toLocaleDateString("ja-JP", {year: "numeric",month: "2-digit",
        day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"});
        if (sender != "") {
            sender = "[" + sender + "] ";
        }
        sender = `[${nowTime}] ${sender}`;
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