const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// HEALTH CHECK
app.get('/', (req, res) => {
  res.json({ PASONG: 'LIVE', upload: 'READY' });
});

// GET ALL SONGS
app.get('/api/songs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ songs: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message, songs: [] });
  }
});

// GET ONE SONG
app.get('/api/songs/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('songs').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(404).json({ error: 'Song not found' }); }
});

// CLOUDINARY SIGNATURE - FIXED
app.post('/api/cloudinary/signature', async (req, res) => {
  try {
    const { folder, public_id, type } = req.body;
    const timestamp = Math.round(Date.now() / 1000);
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!apiKey || !apiSecret || !cloudName) {
      return res.status(500).json({ error: 'Cloudinary keys missing in Vercel env' });
    }

    // Signature must match what frontend sends
    let toSign = `folder=${folder}&public_id=${public_id}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');

    const isCover = type === 'cover' || folder.includes('cover');
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${isCover ? 'image' : 'video'}/upload`;

    res.json({
      song: {
        apiKey, timestamp, signature, folder, public_id, publicId: public_id,
        uploadUrl, tags: type || 'song'
      },
      cover: {
        apiKey, timestamp, signature: crypto.createHash('sha1').update(`folder=pasong-covers&public_id=${public_id}_cover&timestamp=${timestamp}${apiSecret}`).digest('hex'),
        folder: 'pasong-covers',
        public_id: `${public_id}_cover`,
        publicId: `${public_id}_cover`,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        tags: 'cover'
      }
    });

    // SIMPLE VERSION IF ABOVE FAILS - USE THIS ALTERNATIVE:
    // For your frontend we return flat info. Frontend expects info.song and info.cover
    // The block above already returns both signatures

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CREATE SONG - NOW APPROVED SO IT SHOWS IMMEDIATELY
app.post('/api/songs', async (req, res) => {
  try {
    const { title, artist, genre, song_url, cover_url, duration, file_size } = req.body;
    if (!title || !song_url) return res.status(400).json({ error: 'Missing title or song_url' });

    const { data, error } = await supabase.from('songs').insert([{
      title,
      artist: artist || 'Unknown',
      genre: genre || 'Afrobeat',
      song_url,
      cover_url: cover_url || '',
      duration: duration || 0,
      file_size: file_size || 0,
      price: 500,
      currency: 'UGX',
      status: 'approved', // <-- FIXED FROM pending TO approved
      featured: false
    }]).select().single();

    if (error) throw error;
    res.json({ success: true, song: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// UPDATE STATUS (Approve / Pending / Reject)
app.patch('/api/songs/:id', async (req, res) => {
  try {
    const { status, featured, price } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (featured !== undefined) updates.featured = featured;
    if (price !== undefined) updates.price = price;
    
    const { data, error } = await supabase.from('songs').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, song: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE SONG - NEW
app.delete('/api/songs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('songs').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`PASONG API LIVE on ${PORT}`));
module.exports = app;
