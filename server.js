// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const shortid = require("shortid");
// const QRCode = require("qrcode");
// const axios = require("axios");
// const UAParser = require("ua-parser-js");
// const { Parser } = require("json2csv");
// require("dotenv").config();

// const app = express();

// app.use(express.json());
// app.use(cors());
// app.use(express.static("public"));


// // ENV VALUES

// const PORT = process.env.PORT || 3000;
// const BASE_URL = process.env.BASE_URL || "http://localhost:3000";


// // CONNECT CLOUD DATABASE

// mongoose.connect(process.env.MONGO_URL)
// .then(()=>console.log("Cloud DB Connected ☁️"))
// .catch(err=>console.log(err));


// // DATABASE MODEL

// const Link = mongoose.model("Link",{

// url:String,

// shortId:String,

// title:String,

// clicks:{type:Number,default:0},

// qrCode:String,

// expiry:Date,

// visits:[{

// ip:String,

// country:String,

// city:String,

// device:String,

// lat:Number,

// lon:Number,

// time:{

// type:Date,

// default:Date.now

// }

// }]

// });



// // CREATE SHORT LINK

// app.post("/shorten", async (req,res)=>{

// try{

// const {url,title,customName}=req.body;

// const id =
// customName || shortid.generate();

// const shortLink =
// BASE_URL + "/" + id;

// const qr =
// await QRCode.toDataURL(shortLink);

// const link =
// await Link.create({

// url,

// shortId:id,

// title,

// qrCode:qr,

// expiry:new Date(

// Date.now()+7*24*60*60*1000

// )

// });

// res.json({

// shortLink,

// qr

// });

// }catch(e){

// res.status(500).send("error");

// }

// });



// // USER CLICK TRACKING

// app.get("/:id", async (req,res)=>{

// try{

// const link =
// await Link.findOne({

// shortId:req.params.id

// });


// if(!link){

// return res.send("Link not found");

// }


// // USER IP

// const ip =
// req.headers["x-forwarded-for"] ||
// req.socket.remoteAddress;


// // FIX LOCALHOST

// let country="Unknown";
// let city="Unknown";
// let lat=0;
// let lon=0;


// try{

// const ipClean =
// ip=="::1" ? "" : ip;

// const geo =
// await axios.get(

// "https://ipapi.co/"+ipClean+"/json/"

// );

// country =
// geo.data.country_name || "Unknown";

// city =
// geo.data.city || "Unknown";

// lat =
// geo.data.latitude || 0;

// lon =
// geo.data.longitude || 0;

// }catch(err){

// console.log("Geo error");

// }


// // DEVICE

// const parser =
// new UAParser(

// req.headers["user-agent"]

// );

// const device =
// parser.getDevice().type || "Desktop";


// // SAVE VISITOR

// link.visits.push({

// ip,

// country,

// city,

// device,

// lat,

// lon

// });


// // COUNT CLICK

// link.clicks++;

// await link.save();


// // REDIRECT

// res.redirect(link.url);

// }catch(e){

// res.send("error");

// }

// });



// // ALL LINKS

// app.get("/stats/all",

// async(req,res)=>{

// const links =
// await Link.find();

// res.json(links);

// });



// // DELETE LINK

// app.delete("/delete/:id",

// async(req,res)=>{

// await Link.findByIdAndDelete(

// req.params.id

// );

// res.send("Deleted");

// });



// // EXPORT CSV

// app.get("/export/csv",

// async(req,res)=>{

// const links =
// await Link.find();

// const parser =
// new Parser();

// const csv =
// parser.parse(links);

// res.header(
// "Content-Type",
// "text/csv"
// );

// res.attachment(
// "report.csv"
// );

// res.send(csv);

// });



// // SERVER START

// app.listen(PORT,()=>{

// console.log(

// "Server running 🚀 on",
// BASE_URL

// );

// });









// require("dotenv").config();

// const express = require("express");
// const mongoose = require("mongoose");
// const axios = require("axios");
// const UAParser = require("ua-parser-js");

// const app = express();

// app.use(express.json());
// app.use(express.urlencoded({ extended:true }));

// const PORT = process.env.PORT || 3000;
// const BASE_URL = process.env.BASE_URL || "http://localhost:3000";


// // DATABASE CONNECT

// mongoose.connect(process.env.MONGO_URL)

// .then(()=>console.log("MongoDB Connected ☁️"))

// .catch(err=>console.log(err));


// // SCHEMA

// const linkSchema = new mongoose.Schema({

// shortId:String,

// url:String,

// title:String,

// clicks:{
// type:Number,
// default:0
// },

// visits:[{

// ip:String,

// country:String,

// city:String,

// device:String,

// time:{
// type:Date,
// default:Date.now
// }

// }]

// });

// const Link = mongoose.model("Link", linkSchema);


// // HOME PAGE

// app.get("/",(req,res)=>{

// res.send(`

// <h2>Create New Link 🔗</h2>

// <form action="/create" method="POST">

// <input
// name="url"
// placeholder="Enter URL"
// required
// style="width:300px;padding:10px"
// />

// <br><br>

// <input
// name="title"
// placeholder="Title"
// style="width:300px;padding:10px"
// />

// <br><br>

// <input
// name="customName"
// placeholder="Custom link name"
// style="width:300px;padding:10px"
// />

// <br><br>

// <button
// style="
// padding:10px 20px;
// background:#667eea;
// color:white;
// border:none;
// border-radius:5px;
// "
// >
// Generate Link
// </button>

// </form>

// `);

// });


// // CREATE LINK

// app.post("/create", async(req,res)=>{

// try{

// const {url,title,customName} = req.body;

// if(!url){

// return res.send("Enter valid URL");

// }

// const shortId =
// customName ||
// Math.random().toString(36).substring(2,7);

// await Link.create({

// shortId,
// url,
// title:title || "Untitled"

// });

// const shortLink =
// BASE_URL + "/" + shortId;

// res.send(`

// <h3>Link Generated ✅</h3>

// <p>${title || "Untitled"}</p>

// <a href="${shortLink}" target="_blank">

// ${shortLink}

// </a>

// <br><br>

// <a href="/stats/${shortId}">
// View Stats
// </a>

// <br><br>

// <a href="/">
// Create another link
// </a>

// `);

// }

// catch(e){

// console.log(e);

// res.send("Error");

// }

// });


// // TRACK USER CLICK

// app.get("/:id", async(req,res)=>{

// const link =
// await Link.findOne({

// shortId:req.params.id

// });

// if(!link){

// return res.send("Link not found");

// }


// // USER IP

// const ip =
// req.headers["x-forwarded-for"] ||
// req.socket.remoteAddress;


// // LOCATION

// let country="Unknown";
// let city="Unknown";

// try{

// const geo =
// await axios.get(

// "https://ipapi.co/"+ip+"/json/"

// );

// country =
// geo.data.country_name || "Unknown";

// city =
// geo.data.city || "Unknown";

// }catch(e){

// console.log("location error");

// }


// // DEVICE

// const parser =
// new UAParser(

// req.headers["user-agent"]

// );

// const device =
// parser.getDevice().type || "Desktop";


// // SAVE VISIT

// link.visits.push({

// ip,
// country,
// city,
// device

// });

// link.clicks++;

// await link.save();


// // REDIRECT

// res.redirect(link.url);

// });


// // SHOW STATS

// app.get("/stats/:id", async(req,res)=>{

// const link =
// await Link.findOne({

// shortId:req.params.id

// });

// if(!link){

// return res.send("No data");

// }

// res.send(`

// <h2>Analytics 📊</h2>

// <p>
// Title: ${link.title}
// </p>

// <p>
// Original URL:
// ${link.url}
// </p>

// <p>
// Total Clicks:
// ${link.clicks}
// </p>

// <h3>Visitors</h3>

// <pre>

// ${JSON.stringify(link.visits,null,2)}

// </pre>

// <br>

// <a href="/">
// Create new link
// </a>

// `);

// });


// // START SERVER

// app.listen(PORT,()=>{

// console.log(

// "Server running 🚀",
// BASE_URL

// );

// });





require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const UAParser = require("ua-parser-js");
const QRCode = require("qrcode");
const { Parser } = require("json2csv");
const cors = require("cors"); 

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(express.static("public"));
app.use(cors());


const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";


// MongoDB
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected ☁️"))
.catch(err=>console.log(err));


// Schema
const linkSchema = new mongoose.Schema({

shortId:String,
url:String,
title:String,
qrCode:String,
expiry:Date,

clicks:{
type:Number,
default:0
},

visits:[{

ip:String,
country:String,
city:String,
device:String,
lat:Number,
lon:Number,

time:{
type:Date,
default:Date.now
}

}]

});

const Link = mongoose.model("Link", linkSchema);


// Create link
app.post("/shorten", async(req,res)=>{

try{

const {url,title,customName,expiry} = req.body;

if(!url){

return res.json({
error:"Enter URL"
});

}

const shortId =
customName ||
Math.random().toString(36).substring(2,7);

const shortLink =
BASE_URL + "/" + shortId;


// QR code
const qr =
await QRCode.toDataURL(shortLink);


await Link.create({

shortId,
url,
title:title || "Untitled",
qrCode:qr,
expiry:expiry || null

});


res.json({

shortLink,
qr

});

}

catch(e){

console.log(e);

res.json({
error:"Server error"
});

}

});


// Get all links
app.get("/stats/all", async(req,res)=>{

const data =
await Link.find()
.sort({ _id:-1 });

res.json(data);

});


// Delete link
app.delete("/delete/:id", async(req,res)=>{

await Link.findByIdAndDelete(
req.params.id
);

res.json({
status:"deleted"
});

});


// CSV export
app.get("/export", async(req,res)=>{

const data =
await Link.find();

const parser =
new Parser();

const csv =
parser.parse(data);

res.header(
"Content-Type",
"text/csv"
);

res.attachment(
"links.csv"
);

res.send(csv);

});


// Redirect + track
app.get("/:id", async(req,res)=>{

const link =
await Link.findOne({

shortId:req.params.id

});

if(!link){

return res.send("Link not found");

}


// check expiry
if(link.expiry){

const today=new Date();

if(today>link.expiry){

return res.send("Link expired");

}

}


// IP
const ip =
req.headers["x-forwarded-for"] ||
req.socket.remoteAddress;


// location
let country="Unknown";
let city="Unknown";
let lat=0;
let lon=0;

try{

const geo =
await axios.get(

"https://ipapi.co/"+ip+"/json/"

);

country =
geo.data.country_name;

city =
geo.data.city;

lat =
geo.data.latitude;

lon =
geo.data.longitude;

}catch(e){

console.log("geo error");

}


// device
const parser =
new UAParser(

req.headers["user-agent"]

);

const device =
parser.getDevice().type || "Desktop";


// save visit
link.visits.push({

ip,
country,
city,
device,
lat,
lon

});

link.clicks++;

await link.save();


// redirect
res.redirect(link.url);

});


// start
app.listen(PORT,()=>{

console.log(
"Server running 🚀",
BASE_URL
);

});