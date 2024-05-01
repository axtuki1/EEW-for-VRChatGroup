(() => {
    const update = () => {
        const res = document.getElementById("response");
        const req = document.getElementById("request");

        fetch("./api/v1/lastResponse").then(r => r.json()).then((json) => {
            res.innerHTML = JSON.stringify(json.response, null, "\t");
            req.innerHTML = json.requestURL;
        });
    }

    const test = () => {
        fetch("./api/v1/testAnnounce").then(r => r.json()).then((json) => {
            console.log("ok");
        });
    }

    const reconnect = () => {
        fetch("./api/v1/reconnect").then(r => r.json()).then((json) => {
            console.log("ok");
        });
    }
    
    document.getElementById("updateBtn").addEventListener("click", update);
    document.getElementById("testBtn").addEventListener("click", test);
    document.getElementById("reconnectBtn").addEventListener("click", reconnect);
})();