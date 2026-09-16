const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Root - NEVER FAILS
app.get('/', (req, res) => {
  res.json({ 
    PASONG: 'LIVE',
    time: new Date().toISOString(),
    env: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('CLOUDINARY'))
  });
});

// Serve music-store.html explicitly
app.get('/music-store.html', (req,res)=>{
  res.sendFile(path.join(__dirname, 'music-store.html'));
});
app.get('/pasong_checkout.html', (req,res)=>{
  res.sendFile(path.join(__dirname, 'pasong_checkout.html'));
});
app.get('/index.html', (req,res)=>{
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/songs', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    
    if(!url || !key) {
      return res.status(500).json({ error: 'Missing SUPABASE_URL or KEY', env: Object.keys(process.env).filter(k=>k.includes('SUPABASE')), songs: [] });
    }

    const sb = createClient(url, key);
    const { data, error } = await sb.from('songs').select('*').order('created_at', {ascending:false}).limit(50);
    if(error) throw error;
    res.json({ songs: data || [] });
  } catch(e) {
    res.status(500).json({ error: e.message, stack: e.stack, songs: [] });
  }
});

app.get('/api/songs/:id', async (req,res)=>{
  try{
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    const sb = createClient(url, key);
    const { data } = await sb.from('songs').select('*').eq('id', req.params.id).single();
    res.json(data);
  }catch(e){ res.status(404).json({error:e.message}); }
});

// Cloudinary signature
app.post('/api/cloudinary/signature', (req,res)=>{
  try{
    const crypto = require('crypto');
    const { folder='pasong-songs', public_id=`song_${Date.now()}` } = req.body;
    const timestamp = Math.round(Date.now()/1000);
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if(!key || !secret || !cloud) return res.status(500).json({error:'Missing Cloudinary ENV'});

    const sign = (str) => crypto.createHash('sha1').update(str + secret).digest('hex');
    res.json({
      song: { apiKey:key, timestamp, signature: sign(`folder=${folder}&public_id=${public_id}&timestamp=${timestamp}`), folder, public_id, uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/video/upload` },
      cover: { apiKey:key, timestamp, signature: sign(`folder=pasong-covers&public_id=${public_id}_cover&timestamp=${timestamp}`), folder:'pasong-covers', public_id:`${public_id}_cover`, uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/image/upload` }
    });
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/songs', async (req,res)=>{
  try{
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);
    const { title, artist_id, genre, audio_url, cover_url, duration_seconds, file_size } = req.body;
    if(!title || !audio_url) return res.status(400).json({error:'Need title + audio_url'});
    const { data, error } = await sb.from('songs').insert([{ title, artist_id: artist_id||null, genre: genre||'Afrobeat', audio_url, cover_url: cover_url||'', duration_seconds: duration_seconds||0, file_size: file_size||0, price:500, currency:'UGX', status:'approved', featured:false }]).select().single();
    if(error) throw error;
    res.json({success:true, song:data});
  }catch(e){ res.status(500).json({error:e.message}); }
});

module.exports = app;
