const BASE_URL = "https://mylinktracker.onrender.com";

let chartInstance = null;

function login(){

if(user.value==="admin" && pass.value==="1234"){

loginBox.style.display="none";
dashboard.style.display="block";

loadStats();

setInterval(loadStats,5000);

}
else{
alert("Wrong login");
}

}


function shorten(){

fetch(BASE_URL + "/shorten",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

url:url.value,
title:title.value,
customName:custom.value,
expiry:expiry.value

})

})

.then(r=>r.json())

.then(data=>{

responseBox.innerHTML=`

<div class="card">

<h3>Link Generated</h3>

<a target="_blank" href="${data.shortLink}">
${data.shortLink}
</a>

<br><br>

<img width="120" src="${data.qr}">

<br><br>

<button onclick="copyLink('${data.shortLink}')">
Copy
</button>

</div>

`;

url.value="";
title.value="";
custom.value="";
expiry.value="";

loadStats();

})

.catch(err=>{
console.log(err);
alert("Error generating link");
});

}



function loadStats(){

fetch(BASE_URL + "/stats/all")

.then(r=>r.json())

.then(data=>{

let html="";
let labels=[];
let clicks=[];

data.forEach(link=>{

labels.push(link.title);
clicks.push(link.clicks);

html+=`

<div class="link-card">

<h3>${link.title}</h3>

<p>
<a target="_blank" href="${BASE_URL}/${link.shortId}">
${link.shortId}
</a>
</p>

<p>
Clicks: ${link.clicks}
</p>

<p>
Expiry:
${link.expiry ?
new Date(link.expiry).toLocaleDateString()
:"No limit"}
</p>

<img width="80" src="${link.qrCode}">

<br>

<button onclick="showVisitors('${link._id}')">
Visitors
</button>

<button onclick="deleteLink('${link._id}')">
Delete
</button>

<div id="vis-${link._id}"></div>

</div>

`;

});

links.innerHTML=html;

loadChart(labels,clicks);

})

.catch(err=>console.log(err));

}



function showVisitors(id){

fetch(BASE_URL + "/stats/all")

.then(r=>r.json())

.then(data=>{

const link=data.find(x=>x._id===id);

let html="";

link.visits.forEach(v=>{

html+=`

<div class="visitor">

🌍 ${v.country}
<br>

📍 ${v.city}
<br>

💻 ${v.device}
<br>

<a target="_blank"
href="https://www.google.com/maps?q=${v.lat},${v.lon}">
Map
</a>

</div>

`;

});

document.getElementById("vis-"+id).innerHTML=html;

});

}



function deleteLink(id){

fetch(BASE_URL + "/delete/"+id,{

method:"DELETE"

})

.then(()=>loadStats());

}



function copyLink(link){

navigator.clipboard.writeText(link);

alert("Copied");

}



function loadChart(labels,clicks){

if(chartInstance){
chartInstance.destroy();
}

chartInstance = new Chart(chart,{

type:"bar",

data:{
labels,
datasets:[{
label:"Clicks",
data:clicks
}]

}

});

}



function downloadCSV(){

window.open(BASE_URL + "/export");

}