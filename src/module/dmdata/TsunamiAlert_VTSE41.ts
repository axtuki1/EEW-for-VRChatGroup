import { Logger } from "../../util/logger";
import { TsunamiAlert } from "./interface/TsunamiAlert";

export class TsunamiAlert_VTSE41 {

    private callback: Function;
    private logger: Logger = new Logger("TsunamiAlert_VTSE41");

    private activeAlert: TsunamiAlert[] = null;

    public constructor(callback: Function) {
        this.callback = callback;

    }

    public ReceiveData(data: any, xmlData: any) {
        // 津波警報・注意報・予報
        try {
            const TsunamiAlert: TsunamiAlert = this.parseTsunamiAlert(xmlData.body);

        } catch (e) {
            this.logger.error("TsunamiAlert_VTSE41 ReceiveData Error: ");
            this.logger.error(e);
        }
    }

    private parseTsunamiAlert(data: any): TsunamiAlert {
        const alert: TsunamiAlert = {
            eventId: data.eventId,
            serialNo: data.serialNo ? parseInt(data.serialNo) : null,
            title: data.title,
            status: data.status,
            forecasts: data.tsunami.forecasts,
            text: data.text,
            comments: data.comments
        };
        return alert;
    }


    private saveActiveAlert() {
    
    }

    private loadActiveAlert() {
    
    }


}