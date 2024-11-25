export class Ticket {
    public static Classification = {
        EEW: {
            Forecast: "eew.forecast",
            Warning: "eew.warning",
            Realtime: "eew.realtime"
        },
        Telegram: {
            Earthquake: "telegram.earthquake",
            Weather: "telegram.weather",
            Forecast: "telegram.forecast",
            Observation: "telegram.observation",
            Scheduled: "telegram.scheduled",
            Lightning: "telegram.lightning"
        }
    } as const;

    public constructor(data) {
        this.status = data.status;
        if (data.status === "ok") {
            this.responseId = data.responseId;
            this.responseTime = data.responseTime;
            this.status = data.status;
            this.ticket = data.ticket;
            this.websocket = data.websocket;
            this.classifications = data.classifications;
            this.test = data.test;
            this.types = data.types;
            this.formats = data.formats;
            this.appName = data.appName;
            this.error = null;
        } else {
            this.error = data.error;
        }
    }

    public responseId: string;
    public responseTime: string;
    public status: string;
    public ticket: string;
    public websocket: any;
    public classifications: string[];
    public test: boolean;
    public types: string[];
    public formats: string[];
    public appName: string;
    public error: any;
    public isUsed: boolean = false;
}