import express from 'express';
import cors from 'cors';
import axios from 'axios';
const app = express();
app.use(cors({origin:true}));
app.use(express.json());
const BASE='https://pay.pesapal.com/v3';
let token=null;let expiry=0;
async function getToken(){
if(token&&Date.now()<expiry)return token;
const r=await axios.post(`${BASE}/api/Auth/RequestToken`,{
consumer_key:process.env.PESAPAL_CONSUMER_KEY,
consumer_secret:process.env.PESAPAL_CONSUMER_SECRET
});
token=r.data.token;expiry=Date.now()+240000;return token;
}
app.get('/',(req,res)=>res.json({PASONG:"LIVE",settle:"0769719539"}));
app.post('/api/pesapal/create-payment',async(req,res)=>{
try{
const t=await getToken();
const id=`PASONG-${Date.now()}`;
const r=await axios.post(`${BASE}/api/Transactions/SubmitOrderRequest`,{
id,currency:"UGX",amount:Number(req.body.amount)||2000,
description:`PASONG - ${req.body.songTitle||'Song'}`,
callback_url:`${process.env.FRONTEND_URL}/success`,
notification_id:process.env.PESAPAL_IPN_ID,
billing_address:{email_address:req.body.email||"c@pasong.ug",phone_number:"256769719539",country_code:"UG",first_name:"PASONG",last_name:"User"}
},{headers:{Authorization:`Bearer ${t}`}});
res.json({...r.data,SETTLE:"0769719539"});
}catch(e){res.status(500).json(e.response?.data||e.message)}
});
app.post('/api/pesapal/ipn',(req,res)=>{console.log("PASONG -> 0769719539",req.body);res.json({ok:true});});
app.listen(process.env.PORT||10000,()=>console.log("PASONG LIVE"));
