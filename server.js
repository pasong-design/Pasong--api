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

const cleanText = (v, max) => { if(!v) return ''; return String(v).trim().slice(0,max); };
const cleanContext = (v, max=500) => String(v||'').replace(/[|]/g,'').slice(0,max);
const getExtension = (name='') => (name.split('.').pop()||'').toLowerCase();
const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const optionalUUID = (id) => isValidUUID(id)? id : null;
const createSongUUID = () => crypto.randomUUID();
const createCloudinaryPublicId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const supabaseReady = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const cloudinaryReady = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

app.get('/', (req, res) => {
  res.json({ PASONG: 'LIVE', upload: 'READY' });
});

app.post('/api/songs/sign-upload', (req, res) => {
  try {
    if (!cloudinaryReady()) return res.status(500).json({ error: 'Cloudinary not configured.' });
    const { artistName, songTitle, description, genre, contractAccepted, fileName, fileSize, coverFileName, coverFileSize, artistId, albumId, categoryId } = req.body;
    if (contractAccepted!== true) return res.status(400).json({ error: 'Agree to contract.' });
    
    const artist = cleanText(artistName, 100);
    const title = cleanText(songTitle, 150);
    if (!artist) return res.status(400).json({ error: 'Artist required.' });
    if (!title) return res.status(400).json({ error: 'Title required.' });

    const songSize = Number(fileSize);
    const songExt = getExtension(fileName);
    if (songSize > MAX_SONG_SIZE) return res.status(400).json({ error: 'Song >10MB.' });
    if (!ALLOWED_SONG_EXTENSIONS.has(songExt)) return res.status(400).json({ error: 'Only MP3/WAV.' });

    if (!coverFileName) return res.status(400).json({ error: 'Cover image is REQUIRED.' });
    const coverSize = Number(coverFileSize);
    const coverExt = getExtension(coverFileName);
    if (coverSize > MAX_COVER_SIZE) return res.status(400).json({ error: 'Cover >5MB.' });
    if (!ALLOWED_COVER_EXTENSIONS.has(coverExt)) return res.status(400).json({ error: 'Cover must be JPG/PNG/WEBP.' });

    const databaseSongId = createSongUUID();
    const songPublicId = createCloudinaryPublicId('pasong_song');
    const coverPublicId = createCloudinaryPublicId('pasong_cover');
    const timestamp = Math.floor(Date.now() / 1000);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;

    const songContext = `songId=${cleanContext(databaseSongId)}|artist=${cleanContext(artist,100)}|title=${cleanContext(title,150)}`;
    const songParams = { timestamp, folder: 'pasong/songs', public_id: songPublicId, tags: 'pasong-song', context: songContext };
    const songSignature = cloudinary.utils.api_sign_request(songParams, process.env.CLOUDINARY_API_SECRET);

    const coverParams = { timestamp, folder: 'pasong/covers', public_id: coverPublicId, tags: 'pasong-cover' };
    const coverSignature = cloudinary.utils.api_sign_request(coverParams, process.env.CLOUDINARY_API_SECRET);

    return res.json({
      song: {
        songId: databaseSongId,
        artistId: optionalUUID(artistId),
        albumId: optionalUUID(albumId),
        categoryId: optionalUUID(categoryId),
        timestamp,
        cloudName,
        apiKey,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        folder: 'pasong/songs',
        publicId: songPublicId,
        public_id: songPublicId,
        signature: songSignature,
        tags: 'pasong-song',
        context: songContext
      },
      cover: {
        timestamp,
        cloudName,
        apiKey,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        folder: 'pasong/covers',
        publicId: coverPublicId,
        public_id: coverPublicId,
        signature: coverSignature,
        tags: 'pasong-cover'
      }
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/songs/create', async (req, res) => {
  try {
    if (!supabaseReady()) return res.status(500).json({ error: 'Supabase not configured.' });
    const { songId, artistId, albumId, categoryId, title, description, genre, coverUrl, audioUrl, fileSize } = req.body;
    if (!isValidUUID(songId)) return res.status(400).json({ error: 'Invalid songId.' });
    if (!title) return res.status(400).json({ error: 'Title required.' });
    const songData = {
      id: songId,
      artist_id: optionalUUID(artistId),
      album_id: optionalUUID(albumId),
      category_id: optionalUUID(categoryId),
      title: cleanText(title,150),
      description: cleanText(description,500)||null,
      genre: cleanText(genre,100)||null,
      cover_url: coverUrl||null,
      audio_url: audioUrl||null,
      preview_url: audioUrl||null,
      file_size: fileSize? Math.floor(Number(fileSize)) : null,
      price: 500, currency: 'UGX', status: 'pending', featured: false
    };
    const { data, error } = await supabase.from('songs').upsert(songData, { onConflict: 'id' }).select().single();
    if (error) return res.status(500).json({ error: 'Save failed.', details: error.message });
    return res.status(201).json({ success: true, song: data });
  } catch (error) { return res.status(500).json({ error: error.message }); }
});

app.get('/api/songs', async (req, res) => {
  try {
    const { data, error } = await supabase.from('songs').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ songs: data });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => { console.log(`PASONG API running on ${PORT}`); });
