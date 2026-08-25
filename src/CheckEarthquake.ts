export abstract class CheckEarthquake{
    callback: Function;
    constructor(callback: Function) {
        this.callback = callback;
    }
    public abstract Start();
    public abstract Stop();
    public abstract WebAPI(router);
    public abstract DataProcess(data);
}

export interface MetricsData {
    eew_notifications_total?: {
        free?: number;
        supporter?: number;
    },
    eew_events_total?: {
        intensity_1?: number;
        intensity_2?: number;
        intensity_3?: number;
        intensity_4?: number;
        intensity_5_lower?: number;
        intensity_5_upper?: number;
        intensity_6_lower?: number;
        intensity_6_upper?: number;
        intensity_7?: number;
        intensity_unknown?: number;
    },
    process_start_unixTime?: number;
}