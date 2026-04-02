const mongoose = require("mongoose");

const urlSchema =
new mongoose.Schema({

originalUrl:String,

shortId:String,

title:String,

qrCode:String,

clicks:{
type:Number,
default:0
},

expiry:Date,

visits:[{

ip:String,

device:String,

country:String,

city:String,

lat:Number,

lon:Number,

time:{
type:Date,
default:Date.now
}

}],

date:{
type:Date,
default:Date.now
}

});

module.exports =
mongoose.model("URL",urlSchema);