// // LOGIN

// function login(){

// const u=document.getElementById("user").value;
// const p=document.getElementById("pass").value;

// if(u==="admin" && p==="1234"){

// document.getElementById("loginBox").style.display="none";

// document.getElementById("dashboard").style.display="block";

// loadStats();

// // auto refresh every 5 seconds

// setInterval(loadStats,5000);

// }
// else{

// alert("Wrong login");

// }

// }



// // GENERATE LINK

// function shorten(){

// const url=document.getElementById("url").value;
// const title=document.getElementById("title").value;
// const customName=document.getElementById("custom").value;


// if(!url){

// alert("Enter URL");

// return;

// }


// fetch("http://localhost:3000/shorten",{

// method:"POST",

// headers:{

// "Content-Type":"application/json"

// },

// body:JSON.stringify({

// url,
// title,
// customName

// })

// })

// .then(res=>res.json())

// .then(data=>{


// // show generated link response

// document.getElementById("responseBox").innerHTML=`

// <div class="card">

// <h3>✅ Link Generated</h3>

// <p>

// 🔗

// <a target="_blank"

// href="${data.shortLink}">

// ${data.shortLink}

// </a>

// </p>


// <img width="100"

// src="${data.qr}">


// <br>


// <button onclick="copyLink('${data.shortLink}')">

// 📋 Copy Link

// </button>


// <button onclick="generateAnother()">

// ➕ Generate Another Link

// </button>


// </div>

// `;


// // clear inputs

// document.getElementById("url").value="";
// document.getElementById("title").value="";
// document.getElementById("custom").value="";


// loadStats();

// });

// }



// // GENERATE ANOTHER LINK BUTTON

// function generateAnother(){

// document.getElementById("responseBox").innerHTML="";

// }



// // LOAD LINKS

// function loadStats(){

// fetch("http://localhost:3000/stats/all")

// .then(res=>res.json())

// .then(data=>{


// let html="";

// let labels=[];
// let clicks=[];


// data.forEach(item=>{


// labels.push(item.title || item.shortId);

// clicks.push(item.clicks);


// html+=`

// <div class="link-card">

// <h3>

// ${item.title || "Untitled"}

// </h3>


// <p>

// 🔗

// <a target="_blank"

// href="http://localhost:3000/${item.shortId}">

// http://localhost:3000/${item.shortId}

// </a>

// </p>


// <p>

// 👆 Clicks:

// ${item.clicks}

// </p>


// <p>

// ⏳ Expiry:

// ${new Date(item.expiry).toLocaleDateString()}

// </p>


// <img width="80"

// src="${item.qrCode}">


// <br>


// <button onclick="copyLink('http://localhost:3000/${item.shortId}')">

// 📋 Copy

// </button>


// <button onclick="deleteLink('${item._id}')">

// 🗑 Delete

// </button>


// <button onclick="showVisitors('${item._id}')">

// 👥 Visitors

// </button>


// <div id="visitors-${item._id}"></div>


// </div>

// `;

// });


// document.getElementById("links").innerHTML=html;

// loadChart(labels,clicks);

// });

// }



// // DELETE LINK

// function deleteLink(id){

// fetch(`http://localhost:3000/delete/${id}`,{

// method:"DELETE"

// })

// .then(()=>{

// loadStats();

// });

// }



// // COPY LINK

// function copyLink(link){

// navigator.clipboard.writeText(link);

// alert("Copied");

// }



// // VISITORS

// function showVisitors(id){

// fetch("http://localhost:3000/stats/all")

// .then(res=>res.json())

// .then(data=>{


// const link=data.find(l=>l._id===id);


// let html="";

// let unique=new Set();


// link.visits.forEach(v=>{


// unique.add(v.ip);


// html+=`

// <div class="visitor">

// 🌍 ${v.country}

// <br>

// 📍 ${v.city}

// <br>

// 💻 ${v.device}

// <br>

// <a target="_blank"

// href="https://www.google.com/maps?q=${v.lat},${v.lon}">

// 🗺️ Map

// </a>

// </div>

// `;

// });


// html+=`

// <b>

// 👥 Unique Visitors:

// ${unique.size}

// </b>

// `;


// document.getElementById(`visitors-${id}`).innerHTML=html;

// });

// }



// // GRAPH

// function loadChart(labels,clicks){

// const ctx=document.getElementById("chart");


// new Chart(ctx,{

// type:"bar",

// data:{

// labels:labels,

// datasets:[{

// label:"Clicks",

// data:clicks

// }]

// }

// });

// }







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

fetch("/shorten",{

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

<a target="_blank"
href="${data.shortLink}">

${data.shortLink}

</a>

<br><br>

<img width="120"
src="${data.qr}">

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

});

}



function loadStats(){

fetch("/stats/all")

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

<a target="_blank"
href="/${link.shortId}">

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

<img width="80"
src="${link.qrCode}">

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

});

}



function showVisitors(id){

fetch("/stats/all")

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

fetch("/delete/"+id,{

method:"DELETE"

})

.then(()=>loadStats());

}



function copyLink(link){

navigator.clipboard.writeText(link);

alert("Copied");

}



function loadChart(labels,clicks){

new Chart(chart,{

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

window.open("/export");

}