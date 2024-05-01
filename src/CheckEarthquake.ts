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