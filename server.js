const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));

let supabase = null;
function getSupabase(){
  if(supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  // FIX: support your Vercel names
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE;
  
  if(!url || !key){
    console.error('ENV MISSING:', { hasUrl: !!url, hasKey: !!key, envKeys: Object.keys(process.env).filter(k=>k.includes('SUPABASE')) });
    throw new Error(`Missing Supabase ENV. Found: ${Object.keys(process.env).filter(k=>k.includes('SUPABASE')).join(', ')}`);
  }
  supabase = createClient(url, key);
  return supabase;
}

app.get('/', (req,res)=> res.json({ PASONG:'LIVE', upload:'READY', envCheck: Object.keys(process.env).filter(k=>k.includes('SUPABASE') || k.includes('CLOUDINARY')) }));

app.get('/api/songs', async (req,res)=>{
  try{
    const sb = getSupabase();
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await sb.from('songs').select('*').order('created_at',{ascending:false}).limit(limit);
    if(error) throw error;
    res.json({ songs: data || [] });
  }catch(e){
    console.error(' /api/songs ERROR:', e.message);
    res.status(500).json({ error: e.message, songs: [] });
  }
});

app.get('/api/songs/:id', async (req,res)=>{
  try{
    const sb = getSupabase();
    const { data, error } = await sb.from('songs').select('*').eq('id',req.params.id).single();
    if(error) throw error;
    res.json(data);
  }catch(e){ res.status(404).json({error:'Not found'}); }
});

app.post('/api/cloudinary/signature', (req,res)=>{
  try{
    const { folder='pasong-songs', public_id=`song_${Date.now()}` } = req.body;
    const timestamp = Math.round(Date.now()/1000);
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if(!apiKey || !apiSecret || !cloudName) return res.status(500).json({error:'Missing Cloudinary ENV'});

    const toSignSong = `folder=${folder}&public_id=${public_id}&timestamp=${timestamp}`;
    const sigSong = crypto.createHash('sha1').update(toSignSong + apiSecret).digest('hex');
    const toSignCover = `folder=pasong-covers&public_id=${public_id}_cover&timestamp=${timestamp}`;
    const sigCover = crypto.createHash('sha1').update(toSignCover + apiSecret).digest('hex');

    res.json({
      song: { apiKey, timestamp, signature:sigSong, folder, public_id, publicId:public_id, uploadUrl:`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, tags:'song' },
      cover: { apiKey, timestamp, signature:sigCover, folder:'pasong-covers', public_id:`${public_id}_cover`, publicId:`${public_id}_cover`, uploadUrl:`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, tags:'cover' }
    });
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/songs', async (req,res)=>{
  try{
    const sb = getSupabase();
    const { title, artist_id, genre, audio_url, cover_url, duration_seconds, file_size } = req.body;
    if(!title || !audio_url) return res.status(400).json({error:'Missing title or audio_url'});
    const { data, error } = await sb.from('songs').insert([{
      title,
      artist_id: artist_id || null,
      genre: genre || 'Afrobeat',
      audio_url,
      cover_url: cover_url || '',
      duration_seconds: duration_seconds || 0,
      file_size: file_size || 0,
      price: 500,
      currency: 'UGX',
      status: 'approved',
      featured: false
    }]).select().single();
    if(error) throw error;
    res.json({ success:true, song:data });
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.patch('/api/songs/:id', async (req,res)=>{
  try{
    const sb = getSupabase();
    const { data, error } = await sb.from('songs').update(req.body).eq('id',req.params.id).select().single();
    if(error) throw error;
    res.json({success:true, song:data});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.delete('/api/songs/:id', async (req,res)=>{
  try{
    const sb = getSupabase();
    const { error } = await sb.from('songs').delete().eq('id',req.params.id);
    if(error) throw error;
    res.json({success:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

module.exports = app;
