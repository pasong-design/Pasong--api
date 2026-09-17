const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ======================================================
// SUPABASE
// ======================================================

function getSupabase() {
  const url = process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE KEY');
  }

  return createClient(url, key);
}


// ======================================================
// ROOT
// ======================================================

app.get('/', (req, res) => {
  res.json({
    PASONG: 'LIVE',
    time: new Date().toISOString(),
    env: Object.keys(process.env).filter(
      k =>
        k.includes('SUPABASE') ||
        k.includes('CLOUDINARY')
    )
  });
});


// ======================================================
// STATIC PAGES
// ======================================================

app.get('/music-store.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'music-store.html')
  );
});

app.get('/pasong_checkout.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'pasong_checkout.html')
  );
});

app.get('/index.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'index.html')
  );
});


// ======================================================
// GET ALL SONGS + ARTIST PROFILE
// ======================================================

app.get('/api/songs', async (req, res) => {

  try {

    const sb = getSupabase();

    const { data, error } = await sb
      .from('songs')
      .select(`
        *,
        artist:artist_profiles!songs_artist_id_fkey (
          id,
          artist_name,
          stage_name,
          profile_image_url,
          cover_image_url,
          genre,
          bio,
          verified
        )
      `)
      .order('created_at', {
        ascending: false
      })
      .limit(50);

    if (error) {
      throw error;
    }

    const songs = (data || []).map(song => ({

      ...song,

      // Keep artist_id available
      artist_id: song.artist_id || null,

      // Artist profile object
      artist: song.artist || null,

      // Easy-to-use artist name for frontend
      artist_name:
        song.artist?.stage_name ||
        song.artist?.artist_name ||
        'Unknown Artist'

    }));

    res.json({
      songs
    });

  } catch (e) {

    console.error(
      'GET /api/songs ERROR:',
      e
    );

    res.status(500).json({
      error: e.message,
      songs: []
    });

  }

});


// ======================================================
// GET SINGLE SONG + ARTIST PROFILE
// ======================================================

app.get('/api/songs/:id', async (req, res) => {

  try {

    const sb = getSupabase();

    const { data, error } = await sb
      .from('songs')
      .select(`
        *,
        artist:artist_profiles!songs_artist_id_fkey (
          id,
          artist_name,
          stage_name,
          profile_image_url,
          cover_image_url,
          genre,
          bio,
          verified
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        error: 'Song not found'
      });
    }

    const song = {

      ...data,

      artist_id:
        data.artist_id || null,

      artist:
        data.artist || null,

      artist_name:
        data.artist?.stage_name ||
        data.artist?.artist_name ||
        'Unknown Artist'

    };

    res.json({
      song
    });

  } catch (e) {

    console.error(
      'GET /api/songs/:id ERROR:',
      e
    );

    res.status(404).json({
      error: e.message
    });

  }

});


// ======================================================
// CLOUDINARY SIGNATURE
// ======================================================

app.post(
  '/api/cloudinary/signature',
  (req, res) => {

    try {

      const {
        folder = 'pasong-songs',
        public_id = `song_${Date.now()}`
      } = req.body;

      const timestamp =
        Math.round(Date.now() / 1000);

      const key =
        process.env.CLOUDINARY_API_KEY;

      const secret =
        process.env.CLOUDINARY_API_SECRET;

      const cloud =
        process.env.CLOUDINARY_CLOUD_NAME;

      if (!key || !secret || !cloud) {

        return res.status(500).json({
          error: 'Missing Cloudinary ENV'
        });

      }

      const sign = (str) =>
        crypto
          .createHash('sha1')
          .update(str + secret)
          .digest('hex');


      res.json({

        song: {

          apiKey: key,

          timestamp,

          signature: sign(
            `folder=${folder}&public_id=${public_id}&timestamp=${timestamp}`
          ),

          folder,

          public_id,

          uploadUrl:
            `https://api.cloudinary.com/v1_1/${cloud}/video/upload`

        },

        cover: {

          apiKey: key,

          timestamp,

          signature: sign(
            `folder=pasong-covers&public_id=${public_id}_cover&timestamp=${timestamp}`
          ),

          folder:
            'pasong-covers',

          public_id:
            `${public_id}_cover`,

          uploadUrl:
            `https://api.cloudinary.com/v1_1/${cloud}/image/upload`

        }

      });

    } catch (e) {

      res.status(500).json({
        error: e.message
      });

    }

  }
);


// ======================================================
// CREATE SONG
// ======================================================

app.post('/api/songs', async (req, res) => {

  try {

    const sb = getSupabase();

    const {
      title,
      artist_id,
      genre,
      audio_url,
      cover_url,
      duration_seconds,
      file_size
    } = req.body;


    if (!title || !audio_url) {

      return res.status(400).json({
        error:
          'Need title + audio_url'
      });

    }


    const { data, error } = await sb
      .from('songs')
      .insert([{

        title,

        artist_id:
          artist_id || null,

        genre:
          genre || 'Afrobeat',

        audio_url,

        preview_url:
          audio_url,

        cover_url:
          cover_url || '',

        duration_seconds:
          duration_seconds || 0,

        file_size:
          file_size || 0,

        price: 500,

        currency: 'UGX',

        status: 'approved',

        featured: false

      }])
      .select(`
        *,
        artist:artist_profiles!songs_artist_id_fkey (
          id,
          artist_name,
          stage_name,
          profile_image_url,
          cover_image_url,
          genre,
          bio,
          verified
        )
      `)
      .single();


    if (error) {
      throw error;
    }


    const song = {

      ...data,

      artist_name:
        data.artist?.stage_name ||
        data.artist?.artist_name ||
        'Unknown Artist'

    };


    res.json({

      success: true,

      song

    });


  } catch (e) {

    console.error(
      'POST /api/songs ERROR:',
      e
    );

    res.status(500).json({
      error: e.message
    });

  }

});


// ======================================================
// START SERVER
// ======================================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `PASONG API running on port ${PORT}`
  );

});


// ======================================================
// VERCEL / NODE EXPORT
// ======================================================

module.exports = app;
