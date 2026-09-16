import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const MAX_SONG_SIZE = 10 * 1024 * 1024;
const MAX_COVER_SIZE = 5 * 1024 * 1024;
const ALLOWED_SONG_EXTENSIONS = new Set(['mp3','wav']);
const ALLOWED_COVER_EXTENSIONS = new Set(['jpg','jpeg','png','webp']);

const PESAPAL_BASE_URL = process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3';
let pesapalToken = null;
let pesapalTokenExpiry = 0;

async function getPesaPalToken() {
  if (pesapalToken && Date.now() < pesapalTokenExpiry) return pesapalToken;
  if (!process.env.PESAPAL_CONSUMER_KEY ||!process.env.PESAPAL_CONSUMER_SECRET) throw new Error('PesaPal credentials are not configured.');
  const response = await axios.post(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    consumer_key: process.env.PESAPAL_CONSUMER_KEY,
    consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
  }, { headers: { 'Content-Type': 'application/json' } });
  pesapalToken = response.data.token;
  pesapalTokenExpiry = Date.now() + 240000;
  return pesapalToken;
}

// ===== FIX: ADD MISSING HELPERS =====
const cleanText = (v, max) => { if(!v) return ''; return String(v).trim().slice(0,max); };
const cleanContext = (v, max=500) => String(v||'').replace(/[|]/g,'').slice(0,max);
const getExtension = (name='') => (name.split('.').pop()||'').toLowerCase();
const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const optionalUUID = (id) => isValidUUID(id)? id : null;
const createSongUUID = () => crypto.randomUUID();
const createCloudinaryPublicId = () => `pasong_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const supabaseReady = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const cloudinaryReady = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
const pesapalReady = () => Boolean(process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET);

app.get('/', (req, res) => {
  res.json({
    PASONG: 'LIVE', upload: 'READY',
    database: supabaseReady()? 'READY' : 'NOT CONFIGURED',
    cloudinary: cloudinaryReady()? 'READY' : 'NOT CONFIGURED',
    pesapal: pesapalReady()? 'READY' : 'NOT CONFIGURED',
    songsEndpoint: '/api/songs',
    signUploadEndpoint: '/api/songs/sign-upload',
    createSongEndpoint: '/api/songs/create'
  });
});

app.get('/api/songs', async (req, res) => {
  try {
    if (!supabaseReady()) return res.status(500).json({ error: 'Supabase is not configured.' });
    const limitNumber = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const { data, error } = await supabase.from('songs').select(`id,artist_id,album_id,category_id,title,description,genre,cover_url,audio_url,preview_url,file_size,duration_seconds,price,currency,status,plays,downloads,featured,created_at,updated_at`).order('created_at', { ascending: false }).limit(limitNumber);
    if (error) return res.status(500).json({ error: 'Failed to load songs.', details: error.message });
    return res.json({ songs: data || [], nextCursor: null });
  } catch (error) { return res.status(500).json({ error: 'Server error while loading songs.' }); }
});

app.get('/api/songs/:id', async (req, res) => {
  try {
    if (!supabaseReady()) return res.status(500).json({ error: 'Supabase is not configured.' });
    const songId = req.params.id;
    if (!isValidUUID(songId)) return res.status(400).json({ error: 'Invalid song ID.' });
    const { data, error } = await supabase.from('songs').select(`id,artist_id,album_id,category_id,title,description,genre,cover_url,audio_url,preview_url,file_size,duration_seconds,price,currency,status,plays,downloads,featured,created_at,updated_at`).eq('id', songId).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to load song.', details: error.message });
    if (!data) return res.status(404).json({ error: 'Song not found.' });
    return res.json({ song: data });
  } catch (error) { return res.status(500).json({ error: 'Server error while loading song.' }); }
});

app.post('/api/songs/sign-upload', (req, res) => {
  try {
    if (!cloudinaryReady()) return res.status(500).json({ error: 'Cloudinary is not configured.' });
    const { artistName, songTitle, description, genre, contractAccepted, fileName, fileSize, coverFileName, coverFileSize, artistId, albumId, categoryId } = req.body;
    if (contractAccepted!== true) return res.status(400).json({ error: 'You must read and agree to the PASONG upload contract.' });
    const artist = cleanText(artistName, 100);
    const title = cleanText(songTitle, 150);
    const descriptionText = cleanText(description, 500);
    const songGenre = cleanText(genre, 100);
    if (!artist) return res.status(400).json({ error: 'Artist name is required.' });
    if (!title) return res.status(400).json({ error: 'Song title is required.' });
    const songSize = Number(fileSize);
    const songExtension = getExtension(fileName);
    if (!Number.isFinite(songSize) || songSize <= 0) return res.status(400).json({ error: 'Invalid song file size.' });
    if (songSize > MAX_SONG_SIZE) return res.status(400).json({ error: 'Song file must not be larger than 10 MB.' });
    if (!ALLOWED_SONG_EXTENSIONS.has(songExtension)) return res.status(400).json({ error: 'Only MP3 and WAV songs are allowed.' });
    if (coverFileName) {
      const coverSize = Number(coverFileSize);
      const coverExtension = getExtension(coverFileName);
      if (!Number.isFinite(coverSize) || coverSize <= 0) return res.status(400).json({ error: 'Invalid cover image size.' });
      if (coverSize > MAX_COVER_SIZE) return res.status(400).json({ error: 'Cover image must not be larger than 5 MB.' });
      if (!ALLOWED_COVER_EXTENSIONS.has(coverExtension)) return res.status(400).json({ error: 'Cover must be JPG, JPEG, PNG or WEBP.' });
    }
    const databaseSongId = createSongUUID();
    const cloudinaryPublicId = createCloudinaryPublicId();
    const timestamp = Math.floor(Date.now() / 1000);
    const songFolder = 'pasong/songs';
    const coverFolder = 'pasong/covers';
    const songContext = `songId=${cleanContext(databaseSongId)}|artist=${cleanContext(artist,100)}|title=${cleanContext(title,150)}|description=${cleanContext(descriptionText,500)}|genre=${cleanContext(songGenre,100)}|contractAccepted=true|acceptedAt=${timestamp}`;
    const songParams = { timestamp, folder: songFolder, public_id: cloudinaryPublicId, tags: 'pasong-song', context: songContext };
    const songSignature = cloudinary.utils.api_sign_request(songParams, process.env.CLOUDINARY_API_SECRET);
    const coverParams = { timestamp, folder: coverFolder, public_id: cloudinaryPublicId, tags: 'pasong-cover' };
    const coverSignature = cloudinary.utils.api_sign_request(coverParams, process.env.CLOUDINARY_API_SECRET);

    // ===== FIX: THIS RETURN WAS MISSING AND CAUSED CRASH =====
    return res.json({
      songId: databaseSongId,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      song: {...songParams, signature: songSignature },
      cover: {...coverParams, signature: coverSignature }
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}); // <-- THIS BRACE WAS MISSING

// SAVE SONG - NOW OUTSIDE sign-upload (FIXED NESTING)
app.post('/api/songs/create', async (req, res) => {
  try {
    if (!supabaseReady()) return res.status(500).json({ error: 'Supabase is not configured.' });
    const { id, songId, artist_id, album_id, category_id, artistId, albumId, categoryId, title, description, genre, cover_url, audio_url, preview_url, file_size, duration_seconds, status, featured } = req.body;
    const finalSongId = id || songId || createSongUUID();
    if (!isValidUUID(finalSongId)) return res.status(400).json({ error: 'Invalid song UUID.' });
    const finalTitle = cleanText(title, 150);
    if (!finalTitle) return res.status(400).json({ error: 'Song title is required.' });
    const songData = {
      id: finalSongId,
      artist_id: optionalUUID(artist_id || artistId),
      album_id: optionalUUID(album_id || albumId),
      category_id: optionalUUID(category_id || categoryId),
      title: finalTitle,
      description: cleanText(description,500)||null,
      genre: cleanText(genre,100)||null,
      cover_url: cleanText(cover_url,1000)||null,
      audio_url: cleanText(audio_url,1000)||null,
      preview_url: cleanText(preview_url,1000)||null,
      file_size: file_size? Math.floor(Number(file_size)) : null,
      duration_seconds: duration_seconds? Math.floor(Number(duration_seconds)) : null,
      price: 500, currency: 'UGX', status: status || 'pending', featured: featured===true
    };
    const { data, error } = await supabase.from('songs').upsert(songData, { onConflict: 'id' }).select().single();
    if (error) return res.status(500).json({ error: 'Could not save song to Supabase.', details: error.message });
    return res.status(201).json({ success: true, message: 'Song saved successfully.', song: data });
  } catch (error) { return res.status(500).json({ error: 'Server error while saving song.', details: error.message }); }
});

app.patch('/api/songs/:id', async (req, res) => {
  try {
    if (!supabaseReady()) return res.status(500).json({ error: 'Supabase is not configured.' });
    const songId = req.params.id;
    if (!isValidUUID(songId)) return res.status(400).json({ error: 'Invalid song ID.' });
    const allowedFields = ['title','description','genre','cover_url','audio_url','preview_url','file_size','duration_seconds','featured'];
    const updates = {};
    for (const field of allowedFields) if (req.body[field]!== undefined) updates[field] = req.body[field];
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields supplied.' });
    const { data, error } = await supabase.from('songs').update(updates).eq('id', songId).select().single();
    if (error) return res.status(500).json({ error: 'Could not update song.', details: error.message });
    return res.json({ success: true, song: data });
  } catch (error) { return res.status(500).json({ error: 'Server error while updating song.' }); }
});

app.get('/api/payments/pesapal/token', async (req, res) => {
  try {
    if (!pesapalReady()) return res.status(503).json({ error: 'PesaPal is not configured.' });
    const token = await getPesaPalToken();
    return res.json({ success: true, tokenAvailable: Boolean(token) });
  } catch (error) { return res.status(500).json({ error: 'Could not get PesaPal token.', details: error.response?.data || error.message }); }
});

app.use((req, res) => { res.status(404).json({ error: 'PASONG API route not found.', path: req.originalUrl }); });
app.use((error, req, res, next) => {
  console.error('GLOBAL SERVER ERROR:', error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Internal PASONG server error.', details: error.message });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => { console.log(`PASONG API running on port ${PORT}`); });
