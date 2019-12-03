const cors = "https://cors-anywhere.herokuapp.com/"
const parser = new DOMParser();

function fetchFeed() {
    sel = document.getElementById("selectEp")
    sel.innerHTML = `<option selected value="__last__">Dernier épisode</option>`
    inp = document.getElementById("rss")
    
    myHeader = new Headers();
    myHeader.append("Origin", "h.goud.so")

    fetch(cors + inp.value, {
        "headers": myHeader
    })
        .then((res) => {
            if (res.ok)
                return res.text();
            else
                console.log(res)
        })    
        .then((text) => {
            xmlDoc = parser.parseFromString(text,"text/xml");

            items = xmlDoc.getElementsByTagName("item")

            for(i = 0; i < items.length; i++) {
                o = document.createElement("option")
                o.innerHTML = items[i].getElementsByTagName("title")[0].innerHTML.replace("<![CDATA[", "").replace("]]>", "")
                o.setAttribute("value", items[i].getElementsByTagName("guid")[0].innerHTML)

                sel.appendChild(o)
            }

            sel.removeAttribute("disabled")
            sel.removeChild(sel.querySelector("option"))
        })
}

function changeClick(e) {
    if (document.getElementById("checkTemplate").checked) {
        document.getElementById("templateDiv").style = "";
    } else {
        document.getElementById("templateDiv").style = "display: none;";

    }
}