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
  const key = process.env.SUPABASE_KEY;
  if(!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in Vercel ENV');
  supabase = createClient(url, key);
  return supabase;
}

app.get('/', (req,res)=> res.json({ PASONG:'LIVE', upload:'READY', time: new Date().toISOString() }));

app.get('/api/songs', async (req,res)=>{
  try{
    const sb = getSupabase();
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await sb.from('songs').select('*').order('created_at',{ascending:false}).limit(limit);
    if(error) throw error;
    res.json({ songs: data || [] });
  }catch(e){
    console.error(e);
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
    const { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } = process.env;
    if(!CLOUDINARY_API_KEY) return res.status(500).json({error:'Missing Cloudinary ENV'});
    
    const toSignSong = `folder=${folder}&public_id=${public_id}&timestamp=${timestamp}`;
    const sigSong = crypto.createHash('sha1').update(toSignSong + CLOUDINARY_API_SECRET).digest('hex');
    const toSignCover = `folder=pasong-covers&public_id=${public_id}_cover&timestamp=${timestamp}`;
    const sigCover = crypto.createHash('sha1').update(toSignCover + CLOUDINARY_API_SECRET).digest('hex');

    res.json({
      song: { apiKey:CLOUDINARY_API_KEY, timestamp, signature:sigSong, folder, public_id, publicId:public_id, uploadUrl:`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, tags:'song' },
      cover: { apiKey:CLOUDINARY_API_KEY, timestamp, signature:sigCover, folder:'pasong-covers', public_id:`${public_id}_cover`, publicId:`${public_id}_cover`, uploadUrl:`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, tags:'cover' }
    });
  }catch(e){ res.status(500).json({error:e.message}); }
});

// CORRECTED - USES YOUR REAL TABLE FIELDS
app.post('/api/songs', async (req,res)=>{
  try{
    const sb = getSupabase();
    // Correct fields: artist_id, audio_url, duration_seconds
    const { title, artist_id, genre, audio_url, cover_url, duration_seconds, file_size } = req.body;

    if(!title || !audio_url) return res.status(400).json({error:'Missing title or audio_url'});

    const { data, error } = await sb.from('songs').insert([{
      title,
      artist_id: artist_id || null,          // CORRECT
      genre: genre || 'Afrobeat',
      audio_url,                             // CORRECT
      cover_url: cover_url || '',
      duration_seconds: duration_seconds || 0, // CORRECT
      file_size: file_size || 0,
      price: 500,
      currency: 'UGX',
      status: 'approved',
      featured: false
    }]).select().single();

    if(error) throw error;
    res.json({ success:true, song:data });
  }catch(e){ 
    console.error(e);
    res.status(500).json({error:e.message}); 
  }
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
