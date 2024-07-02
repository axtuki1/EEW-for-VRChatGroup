import { Ticket } from "./Ticket";
const WebSocket = require("ws");

export class DMDATA {

    // WebSocket通信を行うためのチケットクラス
    public static Ticket = Ticket;

    private apiKey: string;
    private tickets: Ticket[] = [];

    // callback
    private onOpen: Array<(data: any) => void> = [];
    private onError: Array<(error: any) => void> = [];
    private onReceive: Array<(data: any) => void> = [];
    private onClose: Array<(data: any) => void> = [];
    private onPing: Array<(data: any) => void> = [];

    private ws: WebSocket;

    /**
     * DMDATA APIを利用するためのクラス
     * @param apiKey DMDATA API Key
     */
    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    public dumpTickets() {
        console.log(this.tickets);
    }

    /**
     * 作成したすべてのチケットを取得する
     * @returns チケット一覧
     */
    public getTickets(): Ticket[] {
        return this.tickets;
    }

    /**
     * イベントリスナーを追加する
     * @param event イベント種別
     * @param callback 実行する関数
     */
    public addEventListener(event: "open" | "error" | "receive" | "close" | "ping", callback: (data: any) => void) {
        if (event === "open") {
            this.onOpen.push(callback);
        } else if (event === "error") {
            this.onError.push(callback);
        } else if (event === "receive") {
            this.onReceive.push(callback);
        } else if (event === "close") {
            this.onClose.push(callback);
        } else if (event === "ping") {
            this.onPing.push(callback);
        }
    }

    /**
     * 指定したイベントリスナーを全て削除する
     * @param event イベント種別
     */
    public removeEventListeners(event: "open" | "error" | "receive" | "close" | "ping") {
        if (event === "open") {
            this.onOpen = [];
        } else if (event === "error") {
            this.onError = [];
        } else if (event === "receive") {
            this.onReceive = [];
        } else if (event === "close") {
            this.onClose = [];
        } else if (event === "ping") {
            this.onPing = [];
        }
    }

    /**
     * WebSocket通信に必要なチケットを作成する
     * @param appName アプリケーション名
     * @param classifications 配信区分 DMDATA.Ticket.Classificationに定義されているものを指定
     * @param types データ種類コード 例: VXSE43 {@link https://dmdata.jp/docs/telegrams/#%E9%85%8D%E4%BF%A1%E3%83%87%E3%83%BC%E3%82%BF%E3%81%AE%E3%83%AA%E3%82%B9%E3%83%88|Docs: 一覧}
     * @param formatMode フォーマットモード (デフォルト: json)
     * @param test テスト電文を受け取るか (デフォルト: false)
     * @returns 作成したチケット | エラー情報
     */
    public async createTicket(appName: string, classifications: string[], types: string[], formatMode: "raw" | "json" = "json", test: boolean = false): Promise<Ticket> {
        return await fetch("https://api.dmdata.jp/v2/socket", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + Buffer.from(
                    this.apiKey + ":"
                ).toString('base64')
            },
            body: JSON.stringify({
                "classifications": classifications,
                "types": types,
                "test": test ? "including" : "no",
                "formatMode": formatMode,
                "appName": appName
            })
        }).then(async (res) => {
            return res.json();
        }).then(async json => {
            if (json.status === "ok") {
                const ticket = new Ticket(json);
                this.tickets.push(
                    ticket
                );
                return ticket;
            } else {
                this.onError.forEach(callback => {
                    callback({
                        type: "createTicket",
                        data: json
                    });
                });
                return json;
            }
        }).catch(async error => {
            this.onError.forEach(callback => {
                callback({
                    type: "createTicket",
                    data: error
                });
            });
            return error;
        });
    }

    /**
     * チケットを終了する
     * @param id WebSocketID (チケット内の websocket.id を入力)
     * @returns 
     */
    public async closeTicket(id) {
        return await fetch("https://api.dmdata.jp/v2/socket/" + id, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + Buffer.from(
                    this.apiKey + ':'
                ).toString('base64')
            }
        }).then(async res => res.json()).then(async res => {
            if (res != null && res.status === "error") {
                this.onError.forEach(callback => {
                    callback({
                        type: "closeTicket",
                        data: res
                    });
                });
                return null;
            }
        }).catch(async error => {
            this.onError.forEach(callback => {
                callback({
                    type: "closeTicket",
                    data: error
                });
            });
            return null;
        });
    }

    /**
     * 指定したチケットで接続を開始する
     * @param ticket チケット
     * @returns 
     */
    public startConnect(ticket: Ticket) {
        if (this.tickets.indexOf(ticket) === -1){
            return;
        }
        this.ws = new WebSocket(ticket.websocket.url);
        this.ws.onopen = (event) => {
            this.onOpen.forEach(callback => {
                callback(event);
            });
        }
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "error") {
                this.onError.forEach(callback => {
                    callback(data);
                });
            } else if (data.type === "ping") {
                this.ws.send(JSON.stringify({
                    type: "pong",
                    pingId: data.pingId
                }));
                this.onPing.forEach(callback => {
                    callback(data);
                });
            } else {
                this.onReceive.forEach(callback => {
                    callback(data);
                });
            }
        }
        this.ws.onclose = (event) => {
            this.onClose.forEach(callback => {
                callback(event);
            });
        }
    }

    public closeConnect() {
        if(this.ws != null) {
            this.ws.close();
        }
    }

}