const cors = "https://cors-anywhere.herokuapp.com/"
const parser = new DOMParser();

document.getElementById("rss").addEventListener("blur", fetchFeed)

function fetchFeed() {
    sel = document.getElementById("selectEp")
    sel.innerHTML = `<option selected value="last">Dernier épisode</option>`
    inp = document.getElementById("rss")

    fetch(cors + inp.value)
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