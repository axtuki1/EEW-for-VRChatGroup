(() => {
    const update = () => {
        const res = document.getElementById("response");
        const req = document.getElementById("request");

        fetch("./api/v1/lastResponse").then(r => r.json()).then((json) => {
            res.innerHTML = JSON.stringify(json.response, null, "\t");
            req.innerHTML = json.requestURL;
        });
    }
    
    document.getElementById("updateBtn").addEventListener("click", update);
})();