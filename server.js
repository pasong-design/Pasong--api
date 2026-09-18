const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"]
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://mtufczmjlkvycarxylgh.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* =========================================================
   CLOUDINARY
========================================================= */

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME || "vuehnvkp";

const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY || "621955771344375";

const CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET;

function makeCloudinarySignature(params) {
  const clean = {};

  Object.keys(params).forEach(function (key) {
    if (
      params[key] !== undefined &&
      params[key] !== null &&
      params[key] !== ""
    ) {
      clean[key] = params[key];
    }
  });

  const sortedKeys = Object.keys(clean).sort();

  const stringToSign = sortedKeys
    .map(function (key) {
      return key + "=" + clean[key];
    })
    .join("&");

  return crypto
    .createHash("sha1")
    .update(stringToSign + CLOUDINARY_API_SECRET)
    .digest("hex");
}

/* =========================================================
   COUNTRY / PRICING
========================================================= */

function getCountry(req) {
  const country =
    req.headers["x-vercel-ip-country"] ||
    req.headers["cf-ipcountry"] ||
    req.headers["x-country-code"] ||
    "";

  return String(country).toUpperCase();
}

function getPricing(req) {
  const country = getCountry(req);

  const eastAfrica = [
    "KE",
    "TZ",
    "RW",
    "BI",
    "SS",
    "ET",
    "SO"
  ];

  const africa = [
    "UG",
    "KE",
    "TZ",
    "RW",
    "BI",
    "SS",
    "ET",
    "SO",
    "NG",
    "GH",
    "ZA",
    "ZM",
    "ZW",
    "MW",
    "MZ",
    "BW",
    "NA",
    "CM",
    "CI",
    "SN",
    "SL",
    "LR",
    "GM",
    "GN",
    "CD",
    "CG",
    "AO",
    "DZ",
    "MA",
    "TN",
    "EG"
  ];

  let song = {
    amount: 1,
    currency: "USD",
    label: "$1 USD"
  };

  let cover = {
    amount: 10,
    currency: "USD",
    label: "$10 USD"
  };

  if (country === "UG") {
    song = {
      amount: 700,
      currency: "UGX",
      label: "UGX 700"
    };

    cover = {
      amount: 10000,
      currency: "UGX",
      label: "UGX 10,000"
    };
  } else if (eastAfrica.indexOf(country) !== -1) {
    song = {
      amount: 1000,
      currency: "UGX",
      label: "UGX 1,000"
    };
  } else if (africa.indexOf(country) !== -1) {
    song = {
      amount: 0.57,
      currency: "USD",
      label: "$0.57 USD"
    };
  } else if (country === "GB") {
    song = {
      amount: 1,
      currency: "GBP",
      label: "£1 GBP"
    };
  }

  return {
    country: country || "UNKNOWN",
    song: song,
    cover: cover,
    tip: {
      artistPercent: 70,
      pasongPercent: 30
    }
  };
}

/* =========================================================
   BASIC ROUTES
========================================================= */

app.get("/", function (req, res) {
  res.json({
    success: true,
    message: "PASONG API is running"
  });
});

app.get("/health", function (req, res) {
  res.json({
    success: true,
    status: "PASONG: LIVE",
    upload: "READY",
    cloudinary: CLOUDINARY_CLOUD_NAME ? "READY" : "MISSING",
    supabase: SUPABASE_URL ? "READY" : "MISSING"
  });
});

/* =========================================================
   PRICING
========================================================= */

app.get("/api/pricing", function (req, res) {
  res.json({
    success: true,
    pricing: getPricing(req),
    country: getCountry(req)
  });
});

/* =========================================================
   CLOUDINARY SIGNATURE
========================================================= */

app.get("/api/cloudinary/signature", function (req, res) {
  try {
    const folder =
      req.query.folder || "pasong-profiles";

    const publicId =
      req.query.public_id ||
      req.query.publicId ||
      "pasong_" + Date.now();

    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign = {
      timestamp: timestamp,
      folder: folder,
      public_id: publicId
    };

    const signature = makeCloudinarySignature(paramsToSign);

    res.json({
      success: true,

      cloud_name: CLOUDINARY_CLOUD_NAME,
      cloudName: CLOUDINARY_CLOUD_NAME,

      api_key: CLOUDINARY_API_KEY,
      apiKey: CLOUDINARY_API_KEY,

      timestamp: timestamp,

      signature: signature,

      folder: folder,

      public_id: publicId,
      publicId: publicId,

      upload_url:
        "https://api.cloudinary.com/v1_1/" +
        CLOUDINARY_CLOUD_NAME +
        "/image/upload",

      uploadUrl:
        "https://api.cloudinary.com/v1_1/" +
        CLOUDINARY_CLOUD_NAME +
        "/image/upload"
    });
  } catch (error) {
    console.error("Cloudinary signature error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/api/cloudinary/signature", function (req, res) {
  try {
    const folder =
      req.body.folder || "pasong-profiles";

    const publicId =
      req.body.public_id ||
      req.body.publicId ||
      "pasong_" + Date.now();

    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign = {
      timestamp: timestamp,
      folder: folder,
      public_id: publicId
    };

    const signature = makeCloudinarySignature(paramsToSign);

    res.json({
      success: true,

      cloud_name: CLOUDINARY_CLOUD_NAME,
      cloudName: CLOUDINARY_CLOUD_NAME,

      api_key: CLOUDINARY_API_KEY,
      apiKey: CLOUDINARY_API_KEY,

      timestamp: timestamp,

      signature: signature,

      folder: folder,

      public_id: publicId,
      publicId: publicId,

      upload_url:
        "https://api.cloudinary.com/v1_1/" +
        CLOUDINARY_CLOUD_NAME +
        "/image/upload",

      uploadUrl:
        "https://api.cloudinary.com/v1_1/" +
        CLOUDINARY_CLOUD_NAME +
        "/image/upload"
    });
  } catch (error) {
    console.error("Cloudinary signature POST error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   SAVE ARTIST PROFILE
   Browser sends Supabase access token.
   Backend verifies the user and saves with service role.
========================================================= */

app.post("/api/artist-profile/save", async function (req, res) {
  try {
    const authorization =
      req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Missing authentication token"
      });
    }

    const accessToken =
      authorization.substring(7).trim();

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "Missing access token"
      });
    }

    const userClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    const userResult =
      await userClient.auth.getUser(accessToken);

    if (userResult.error || !userResult.data.user) {
      console.error(
        "User verification error:",
        userResult.error
      );

      return res.status(401).json({
        success: false,
        error: "Invalid or expired login session"
      });
    }

    const user = userResult.data.user;

    const body = req.body || {};

    const artistName =
      body.artist_name ||
      body.artistName ||
      "";

    const stageName =
      body.stage_name ||
      body.stageName ||
      "";

    const mobileNumber =
      body.mobile_number ||
      body.mobileNumber ||
      "";

    const genre =
      body.genre ||
      "";

    const bio =
      body.bio ||
      "";

    const profileImageUrl =
      body.profile_image_url ||
      body.profileImageUrl ||
      "";

    const coverImageUrl =
      body.cover_image_url ||
      body.coverImageUrl ||
      "";

    const profileData = {
      user_id: user.id,
      artist_name: artistName,
      stage_name: stageName,
      mobile_number: mobileNumber,
      genre: genre,
      bio: bio,
      updated_at: new Date().toISOString()
    };

    if (profileImageUrl) {
      profileData.profile_image_url =
        profileImageUrl;
    }

    if (coverImageUrl) {
      profileData.cover_image_url =
        coverImageUrl;
    }

    const result = await supabase
      .from("artist_profiles")
      .upsert(
        profileData,
        {
          onConflict: "user_id"
        }
      )
      .select()
      .single();

    if (result.error) {
      console.error(
        "Artist profile database error:",
        result.error
      );

      return res.status(500).json({
        success: false,
        error: result.error.message,
        details: result.error.details || null
      });
    }

    res.json({
      success: true,
      message: "Artist profile saved successfully",
      profile: result.data
    });
  } catch (error) {
    console.error(
      "Artist profile save error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   GET ARTIST PROFILE
========================================================= */

app.get("/api/artist-profile", async function (req, res) {
  try {
    const userId =
      req.query.user_id ||
      req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "user_id is required"
      });
    }

    const result = await supabase
      .from("artist_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error.message
      });
    }

    res.json({
      success: true,
      profile: result.data
    });
  } catch (error) {
    console.error(
      "Get artist profile error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   SONG UPLOAD SIGNATURE
========================================================= */

app.get("/api/songs/sign-upload", function (req, res) {
  try {
    const title =
      req.query.title || "song";

    const artistName =
      req.query.artist_name ||
      req.query.artistName ||
      "artist";

    const hasCover =
      String(req.query.has_cover || "").toLowerCase() ===
      "true";

    if (!hasCover) {
      return res.status(400).json({
        success: false,
        error: "Cover image is required"
      });
    }

    const safeTitle =
      String(title)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 60);

    const safeArtist =
      String(artistName)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 60);

    const folder =
      "pasong-songs/" + safeArtist;

    const timestamp =
      Math.floor(Date.now() / 1000);

    const audioPublicId =
      safeTitle + "_" + Date.now();

    const audioParams = {
      timestamp: timestamp,
      folder: folder,
      public_id: audioPublicId
    };

    const coverPublicId =
      safeTitle + "_cover_" + Date.now();

    const coverParams = {
      timestamp: timestamp,
      folder: folder,
      public_id: coverPublicId
    };

    res.json({
      success: true,

      audio: {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        timestamp: timestamp,
        signature:
          makeCloudinarySignature(audioParams),
        folder: folder,
        public_id: audioPublicId,
        resource_type: "video"
      },

      cover: {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        timestamp: timestamp,
        signature:
          makeCloudinarySignature(coverParams),
        folder: folder,
        public_id: coverPublicId,
        resource_type: "image"
      }
    });
  } catch (error) {
    console.error(
      "Song signature error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   SONGS
========================================================= */

app.get("/api/songs", async function (req, res) {
  try {
    const result = await supabase
      .from("songs")
      .select("*")
      .eq("status", "approved")
      .not("cover_url", "is", null)
      .order("created_at", {
        ascending: false
      });

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error.message
      });
    }

    const pricing = getPricing(req);

    const songs = (result.data || []).map(function (song) {
      return {
        ...song,
        display_price: pricing.song.amount,
        display_currency: pricing.song.currency,
        display_price_label: pricing.song.label
      };
    });

    res.json({
      success: true,
      songs: songs,
      nextCursor: null
    });
  } catch (error) {
    console.error(
      "Get songs error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   SINGLE SONG
========================================================= */

app.get("/api/songs/:id", async function (req, res) {
  try {
    const result = await supabase
      .from("songs")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error.message
      });
    }

    if (!result.data) {
      return res.status(404).json({
        success: false,
        error: "Song not found"
      });
    }

    const pricing = getPricing(req);

    res.json({
      success: true,
      song: {
        ...result.data,
        display_price: pricing.song.amount,
        display_currency: pricing.song.currency,
        display_price_label: pricing.song.label
      }
    });
  } catch (error) {
    console.error(
      "Get single song error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   CREATE SONG
========================================================= */

app.post("/api/songs/create", async function (req, res) {
  try {
    const body = req.body || {};

    const title =
      body.title || "";

    const artistId =
      body.artist_id ||
      body.artistId ||
      null;

    const audioUrl =
      body.audio_url ||
      body.audioUrl ||
      "";

    const coverUrl =
      body.cover_url ||
      body.coverUrl ||
      "";

    const genre =
      body.genre ||
      null;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: "Song title is required"
      });
    }

    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: "Audio URL is required"
      });
    }

    if (!coverUrl) {
      return res.status(400).json({
        success: false,
        error: "Cover image is required"
      });
    }

    const insertData = {
      title: title,
      artist_id: artistId,
      audio_url: audioUrl,
      cover_url: coverUrl,
      genre: genre,
      price: 700,
      currency: "UGX",
      status: "approved"
    };

    const result = await supabase
      .from("songs")
      .insert(insertData)
      .select()
      .single();

    if (result.error) {
      console.error(
        "Create song error:",
        result.error
      );

      return res.status(500).json({
        success: false,
        error: result.error.message
      });
    }

    res.json({
      success: true,
      message: "Song uploaded successfully",
      song: result.data
    });
  } catch (error) {
    console.error(
      "Song create exception:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   COMPATIBILITY SONG POST
========================================================= */

app.post("/api/songs", async function (req, res) {
  try {
    const body = req.body || {};

    const result = await supabase
      .from("songs")
      .insert({
        title: body.title || "",
        artist_id:
          body.artist_id ||
          body.artistId ||
          null,
        audio_url:
          body.audio_url ||
          body.audioUrl ||
          "",
        cover_url:
          body.cover_url ||
          body.coverUrl ||
          "",
        genre: body.genre || null,
        price: 700,
        currency: "UGX",
        status: "approved"
      })
      .select()
      .single();

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error.message
      });
    }

    res.json({
      success: true,
      song: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   COVER STATUS
========================================================= */

app.get("/api/songs/:id/cover-status", async function (req, res) {
  try {
    const result = await supabase
      .from("songs")
      .select("id, cover_url, status")
      .eq("id", req.params.id)
      .maybeSingle();

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error.message
      });
    }

    if (!result.data) {
      return res.status(404).json({
        success: false,
        error: "Song not found"
      });
    }

    res.json({
      success: true,
      hasCover: !!result.data.cover_url,
      coverUrl: result.data.cover_url,
      status: result.data.status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, function () {
  console.log(
    "PASONG API running on port " + PORT
  );
});
