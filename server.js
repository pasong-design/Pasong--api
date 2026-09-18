const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const PORT = process.env.PORT || 10000;

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME;

const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY;

const CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET;

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );


/* =========================================================
   HEALTH
========================================================= */

app.get("/health", function(req, res) {

  return res.json({
    success: true,
    status: "PASONG: LIVE",
    upload: "READY",
    cloudinary: "READY",
    supabase: "READY"
  });

});


/* =========================================================
   AUTHENTICATED USER
========================================================= */

async function getAuthenticatedUser(req) {

  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token =
    header.substring(7).trim();

  if (!token) {
    return null;
  }

  const result =
    await supabase.auth.getUser(token);

  if (result.error || !result.data.user) {
    return null;
  }

  return result.data.user;
}


/* =========================================================
   COUNTRY / PRICING
========================================================= */

function getCountry(req) {

  const headers =
    req.headers || {};

  const country =
    headers["x-vercel-ip-country"] ||
    headers["cf-ipcountry"] ||
    headers["x-country-code"] ||
    "UG";

  return String(country)
    .trim()
    .toUpperCase();
}


function getPricing(country) {

  const eastAfrica = [
    "KE",
    "TZ",
    "RW",
    "BI",
    "SS"
  ];

  const otherAfrica = [
    "NG",
    "GH",
    "ZA",
    "ZM",
    "ZW",
    "ET",
    "SN",
    "CI",
    "CM",
    "CD",
    "CG",
    "AO",
    "MZ",
    "MW",
    "NA",
    "BW",
    "SL",
    "LR",
    "GM"
  ];

  if (country === "UG") {

    return {
      amount: 700,
      currency: "UGX",
      label: "UGX 700"
    };

  }

  if (eastAfrica.includes(country)) {

    return {
      amount: 1000,
      currency: "UGX",
      label: "UGX 1,000"
    };

  }

  if (otherAfrica.includes(country)) {

    return {
      amount: 0.57,
      currency: "USD",
      label: "$0.57"
    };

  }

  if (country === "GB") {

    return {
      amount: 1,
      currency: "GBP",
      label: "£1"
    };

  }

  return {
    amount: 1,
    currency: "USD",
    label: "$1"
  };

}


function getCoverDesignPrice(country) {

  if (country === "UG") {

    return {
      amount: 10000,
      currency: "UGX",
      label: "UGX 10,000"
    };

  }

  return {
    amount: 10,
    currency: "USD",
    label: "$10"
  };

}


function getTipSplit(amount) {

  return {
    artist: Number((amount * 0.70).toFixed(2)),
    pasong: Number((amount * 0.30).toFixed(2))
  };

}


/* =========================================================
   ROOT
========================================================= */

app.get("/", function(req, res) {

  return res.json({
    success: true,
    name: "PASONG API",
    status: "LIVE"
  });

});


/* =========================================================
   PRICING
========================================================= */

app.get("/api/pricing", function(req, res) {

  const country =
    getCountry(req);

  const pricing =
    getPricing(country);

  return res.json({
    country: country,
    price: pricing
  });

});


app.get("/api/cover-design-price", function(req, res) {

  const country =
    getCountry(req);

  const pricing =
    getCoverDesignPrice(country);

  return res.json({
    country: country,
    price: pricing
  });

});


app.get("/api/tip-split", function(req, res) {

  const amount =
    Number(req.query.amount || 0);

  if (!amount || amount <= 0) {

    return res.status(400).json({
      error: "Invalid amount."
    });

  }

  return res.json(
    getTipSplit(amount)
  );

});


/* =========================================================
   CLOUDINARY SIGNATURE
========================================================= */

app.post(
  "/api/cloudinary/signature",
  async function(req, res) {

    try {

      const user =
        await getAuthenticatedUser(req);

      if (!user) {

        return res.status(401).json({
          error: "Missing authentication token."
        });

      }

      const folder =
        String(
          req.body.folder ||
          "pasong-songs"
        ).trim();

      const timestamp =
        Math.floor(
          Date.now() / 1000
        );

      const stringToSign =
        "folder=" +
        folder +
        "&timestamp=" +
        timestamp;

      const signature =
        crypto
          .createHash("sha1")
          .update(
            stringToSign +
            CLOUDINARY_API_SECRET
          )
          .digest("hex");

      return res.json({

        success: true,

        cloud_name:
          CLOUDINARY_CLOUD_NAME,

        api_key:
          CLOUDINARY_API_KEY,

        timestamp:
          timestamp,

        signature:
          signature,

        folder:
          folder

      });

    } catch (error) {

      return res.status(500).json({
        error: error.message
      });

    }

  }
);


app.get(
  "/api/cloudinary/signature",
  async function(req, res) {

    try {

      const user =
        await getAuthenticatedUser(req);

      if (!user) {

        return res.status(401).json({
          error: "Missing authentication token."
        });

      }

      const folder =
        String(
          req.query.folder ||
          "pasong-songs"
        ).trim();

      const timestamp =
        Math.floor(
          Date.now() / 1000
        );

      const stringToSign =
        "folder=" +
        folder +
        "&timestamp=" +
        timestamp;

      const signature =
        crypto
          .createHash("sha1")
          .update(
            stringToSign +
            CLOUDINARY_API_SECRET
          )
          .digest("hex");

      return res.json({

        success: true,

        cloud_name:
          CLOUDINARY_CLOUD_NAME,

        api_key:
          CLOUDINARY_API_KEY,

        timestamp:
          timestamp,

        signature:
          signature,

        folder:
          folder

      });

    } catch (error) {

      return res.status(500).json({
        error: error.message
      });

    }

  }
);


/* =========================================================
   FIND PASONG USER
========================================================= */

app.get(
  "/api/users/find",
  async function(req, res) {

    try {

      const loggedInUser =
        await getAuthenticatedUser(req);

      if (!loggedInUser) {

        return res.status(401).json({
          error: "Missing authentication token."
        });

      }

      const email =
        String(
          req.query.email || ""
        )
        .trim()
        .toLowerCase();

      if (!email) {

        return res.status(400).json({
          error: "Email is required."
        });

      }

      const result =
        await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });

      if (result.error) {

        return res.status(500).json({
          error: result.error.message
        });

      }

      const users =
        result.data.users || [];

      const found =
        users.find(function(user) {

          return String(
            user.email || ""
          )
          .trim()
          .toLowerCase() === email;

        });

      if (!found) {

        return res.status(404).json({
          error:
            "No PASONG account was found for " +
            email
        });

      }

      return res.json({
        success: true,
        user_id: found.id,
        email: found.email
      });

    } catch (error) {

      return res.status(500).json({
        error: error.message
      });

    }

  }
);


/* =========================================================
   SAVE ARTIST PROFILE
========================================================= */

app.post(
  "/api/artist-profile/save",
  async function(req, res) {

    try {

      const user =
        await getAuthenticatedUser(req);

      if (!user) {

        return res.status(401).json({
          error: "Missing authentication token."
        });

      }

      const body =
        req.body || {};

      const existingResult =
        await supabase
          .from("artist_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

      if (existingResult.error) {

        return res.status(500).json({
          error:
            existingResult.error.message
        });

      }

      const existing =
        existingResult.data || {};

      const performingName =
        String(
          body.performing_name ||
          body.stage_name ||
          body.artist_name ||
          existing.performing_name ||
          existing.stage_name ||
          existing.artist_name ||
          ""
        ).trim();

      const realName =
        String(
          body.real_name ||
          existing.real_name ||
          ""
        ).trim();

      const mobileMoneyNumber =
        String(
          body.mobile_money_number ||
          body.mobile_number ||
          existing.mobile_money_number ||
          existing.mobile_number ||
          ""
        ).trim();

      const mobileMoneyProvider =
        String(
          body.mobile_money_provider ||
          existing.mobile_money_provider ||
          ""
        ).trim();

      if (!performingName) {

        return res.status(400).json({
          error:
            "Performing name is required."
        });

      }

      if (!mobileMoneyNumber) {

        return res.status(400).json({
          error:
            "Mobile money number is required."
        });

      }

      const profileData = {

        user_id:
          user.id,

        artist_name:
          performingName,

        stage_name:
          performingName,

        performing_name:
          performingName,

        real_name:
          realName,

        mobile_number:
          mobileMoneyNumber,

        mobile_money_number:
          mobileMoneyNumber,

        mobile_money_provider:
          mobileMoneyProvider ||

          existing.mobile_money_provider ||

          "MTN",

        mobile_money_verified:
          existing.mobile_money_verified ||
          false,

        identity_verified:
          existing.identity_verified ||
          false,

        identity_verified_at:
          existing.identity_verified_at ||
          null,

        mobile_money_verified_at:
          existing.mobile_money_verified_at ||
          null,

        account_status:
          existing.account_status ||
          "active"

      };

      if (
        body.profile_image_url !== undefined
      ) {

        profileData.profile_image_url =
          body.profile_image_url;

      } else if (
        existing.profile_image_url
      ) {

        profileData.profile_image_url =
          existing.profile_image_url;

      }

      const result =
        await supabase
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

        return res.status(500).json({
          error:
            result.error.message
        });

      }

      return res.json({
        success: true,
        profile: result.data
      });

    } catch (error) {

      return res.status(500).json({
        error: error.message
      });

    }

  }
);


/* =========================================================
   GET ARTIST PROFILE
========================================================= */

app.get(
  "/api/artist-profile",
  async function(req, res) {

    try {

      const user =
        await getAuthenticatedUser(req);

      if (!user) {

        return res.status(401).json({
          error: "Missing authentication token."
        });

      }

      const result =
        await supabase
          .from("artist_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

      if (result.error) {

        return res.status(500).json({
          error:
            result.error.message
        });

      }

      return res.json({
        success: true,
        profile:
          result.data || null
      });

    } catch (error) {

      return res.status(500).json({
        error: error.message
      });

    }

  }
);


/* =========================================================
   SIGN SONG UPLOAD
========================================================= */

app.post(
  "/api/songs/sign-upload",
  async function(req, res) {

    try {

      const user =
        await getAuthenticatedUser(req);

      if (!user) {

        return res.status(401).json({
          error: "Missing authentication token."
        });

      }

      const hasCover =
        req.body &&
        req.body.has_cover === true;

      if (!hasCover) {

        return res.status(400).json({
          error:
            "Cover image is required before song upload."
        });

      }

      return res.json({
        success: true,
        ready: true
      });

    } catch (error) {

      return res.status(500).json({
        error: error.message
      });

    }

  }
);


/* =========================================================
   CREATE SONG
========================================================= */

app.post(
  "/api/songs/create",
  async function(req, res) {

    try {

      const loggedInUser =
        await getAuthenticatedUser(req);

      if (!loggedInUser) {

        return res.status(401).json({
          error: "Missing authentication token."
        });

      }

      const body =
        req.body || {};

      const title =
        String(
          body.title || ""
        ).trim();

      const coverUrl =
        String(
          body.cover_url || ""
        ).trim();

      const audioUrl =
        String(
          body.audio_url || ""
        ).trim();

      const artistUserId =
        body.artist_user_id ||
        loggedInUser.id;

      const producerUserId =
        body.producer_user_id ||
        null;

      const writerUserId =
        body.writer_user_id ||
        null;

      const labelName =
        String(
          body.label_name || ""
        ).trim();

      if (!title) {

        return res.status(400).json({
          error:
            "Song title is required."
        });

      }

      if (!coverUrl) {

        return res.status(400).json({
          error:
            "Cover image is required."
        });

      }

      if (!audioUrl) {

        return res.status(400).json({
          error:
            "Audio URL is required."
        });

      }


      /* -----------------------------------------------------
         ARTIST PROFILE
      ----------------------------------------------------- */

      const artistProfileResult =
        await supabase
          .from("artist_profiles")
          .select("*")
          .eq(
            "user_id",
            artistUserId
          )
          .maybeSingle();

      if (artistProfileResult.error) {

        return res.status(500).json({
          error:
            artistProfileResult.error.message
        });

      }

      const artistProfile =
        artistProfileResult.data;

      if (!artistProfile) {

        return res.status(400).json({
          error:
            "Artist profile not found. Please save your Artist Profile first."
        });

      }

      const artistProfileId =
        artistProfile.id;


      /* -----------------------------------------------------
         PRODUCER VALIDATION
      ----------------------------------------------------- */

      if (producerUserId) {

        const producerResult =
          await supabase.auth.admin.getUserById(
            producerUserId
          );

        if (
          producerResult.error ||
          !producerResult.data.user
        ) {

          return res.status(400).json({
            error:
              "Producer PASONG account could not be verified."
          });

        }

      }


      /* -----------------------------------------------------
         WRITER VALIDATION
      ----------------------------------------------------- */

      if (writerUserId) {

        const writerResult =
          await supabase.auth.admin.getUserById(
            writerUserId
          );

        if (
          writerResult.error ||
          !writerResult.data.user
        ) {

          return res.status(400).json({
            error:
              "Writer PASONG account could not be verified."
          });

        }

      }


      /* -----------------------------------------------------
         DUPLICATE AUDIO CHECK
      ----------------------------------------------------- */

      let duplicateQuery =
        await supabase
          .from("songs")
          .select(
            "id,title,artist_id,audio_url"
          )
          .eq(
            "audio_url",
            audioUrl
          )
          .limit(1);

      if (duplicateQuery.error) {

        return res.status(500).json({
          error:
            duplicateQuery.error.message
        });

      }

      if (
        duplicateQuery.data &&
        duplicateQuery.data.length > 0
      ) {

        return res.status(409).json({
          error:
            "This song appears to already be uploaded to PASONG.",
          song:
            duplicateQuery.data[0]
        });

      }


      /* -----------------------------------------------------
         PRICING
      ----------------------------------------------------- */

      const country =
        getCountry(req);

      const pricing =
        getPricing(country);


      /* -----------------------------------------------------
         SONG INSERT
      ----------------------------------------------------- */

      const insertData = {

        artist_id:
          artistProfileId,

        artist_user_id:
          artistUserId,

        uploader_user_id:
          loggedInUser.id,

        producer_user_id:
          producerUserId,

        writer_user_id:
          writerUserId,

        label_name:
          labelName || null,

        title:
          title,

        price:
          pricing.amount,

        currency:
          pricing.currency,

        status:
          "approved",

        cover_url:
          coverUrl,

        audio_url:
          audioUrl

      };


      /* Preserve optional fields when supplied */

      if (
        body.genre !== undefined &&
        body.genre !== null &&
        String(body.genre).trim()
      ) {

        insertData.genre =
          String(body.genre).trim();

      }

      if (
        body.category_id !== undefined &&
        body.category_id !== null &&
        String(body.category_id).trim()
      ) {

        insertData.category_id =
          body.category_id;

      }

      if (
        body.album_id !== undefined &&
        body.album_id !== null &&
        String(body.album_id).trim()
      ) {

        insertData.album_id =
          body.album_id;

      }


      const result =
        await supabase
          .from("songs")
          .insert(insertData)
          .select()
          .single();

      if (result.error) {

        return res.status(500).json({
          error:
            result.error.message
        });

      }


      return res.status(201).json({

        success: true,

        message:
          "Song uploaded successfully.",

        song:
          result.data

      });

    } catch (error) {

      return res.status(500).json({
        error: error.message
      });

    }

  }
);


/* =========================================================
   COMPATIBILITY SONG POST
========================================================= */

app.post(
  "/api/songs",
  async function(req, res) {

    try {

      const loggedInUser =
        await getAuthenticatedUser(req);

      if (!loggedInUser) {

        return res.status(401).json({
          error: "Missing authentication token."
        });

      }

      const body =
        req.body || {};

      const title =
        String(
          body.title || ""
        ).trim();

      const coverUrl =
        String(
          body.cover_url || ""
        ).trim();

      const audioUrl =
        String(
          body.audio_url || ""
        ).trim();

      const artistUserId =
        body.artist_user_id ||
        loggedInUser.id;

      if (!title) {

        return res.status(400).json({
          error:
            "Song title is required."
        });

      }

      if (!coverUrl) {

        return res.status(400).json({
          error:
            "Cover image is required."
        });

      }

      if (!audioUrl) {

        return res.status(400).json({
          error:
            "Audio URL is required."
        });

      }

      const artistProfileResult =
        await supabase
          .from("artist_profiles")
          .select("*")
          .eq(
            "user_id",
            artistUserId
          )
          .maybeSingle();

      if (artistProfileResult.error) {

        return res.status(500).json({
          error:
            artistProfileResult.error.message
        });

      }

      if (!artistProfileResult.data) {

        return res.status(400).json({
          error:
            "Artist profile not found."
        });

      }

      const country =
        getCountry(req);

      const pricing =
        getPricing(country);

      const insertData = {

        artist_id:
          artistProfileResult.data.id,

        artist_user_id:
          artistUserId,

        uploader_user_id:
          loggedInUser.id,

        producer_user_id:
          body.producer_user_id ||
          null,

        writer_user_id:
          body.writer_user_id ||
          null,

        label_name:
          body.label_name ||
          null,

        title:
          title,

        price:
          pricing.amount,

        currency:
          pricing.currency,

        status:
          "approved",

        cover_url:
          coverUrl,

        audio_url:
          audioUrl

      };

      if (
        body.genre !== undefined &&
        body.genre !== null &&
        String(body.genre).trim()
      ) {

        insertData.genre =
          String(body.genre).trim();

      }

      if (
        body.category_id !== undefined &&
        body.category_id !== null
      ) {

        insertData.category_id =
          body.category_id;

      }

      if (
        body.album_id !== undefined &&
        body.album_id !== null
      ) {

        insertData.album_id =
          body.album_id;

      }

      const result =
        await supabase
          .from("songs")
          .insert(insertData)
          .select()
          .single();

      if (result.error) {

        return res.status(500).json({
          error:
            result.error.message
        });

      }

      return res.status(201).json({
        success: true,
        message:
          "Song uploaded successfully.",
        song:
          result.data
      });

    } catch (error) {

      return res.status(500).json({
        error: error.message
      });

    }

  }
);


/* =========================================================
   GET ALL APPROVED SONGS
   ARTIST NAME FIX
========================================================= */

app.get(
  "/api/songs",
  async function(req, res) {

    try {

      const country =
        getCountry(req);

      const pricing =
        getPricing(country);

      const result =
        await supabase
          .from("songs")
          .select(`
            *,
            artist_profiles:artist_id (
              artist_name,
              stage_name,
              performing_name
            )
          `)
          .eq(
            "status",
            "approved"
          )
          .not(
            "cover_url",
            "is",
            null
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );

      if (result.error) {

        return res.status(500).json({
          error:
            result.error.message
        });

      }

      const songs =
        (result.data || [])
          .map(function(song) {

            const profile =
              song.artist_profiles ||
              {};

            const artistName =
              profile.performing_name ||
              profile.stage_name ||
              profile.artist_name ||
              "Unknown Artist";

            return {

              id:
                song.id,

              title:
                song.title,

              artist_name:
                artistName,

              artist:
                artistName,

              genre:
                song.genre ||
                "Music",

              category:
                song.category ||
                "Music",

              cover_url:
                song.cover_url,

              audio_url:
                song.audio_url,

              status:
                song.status,

              price:
                pricing.amount,

              currency:
                pricing.currency,

              price_label:
                pricing.label

            };

          });


      return res.json({

        songs:
          songs,

        nextCursor:
          null

      });

    } catch (error) {

      return res.status(500).json({
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   GET SINGLE SONG
========================================================= */

app.get(
  "/api/songs/:id",
  async function(req, res) {

    try {

      const songId =
        req.params.id;

      const country =
        getCountry(req);

      const pricing =
        getPricing(country);

      const result =
        await supabase
          .from("songs")
          .select(`
            *,
            artist_profiles:artist_id (
              artist_name,
              stage_name,
              performing_name,
              profile_image_url
            )
          `)
          .eq(
            "id",
            songId
          )
          .maybeSingle();

      if (result.error) {

        return res.status(500).json({
          error:
            result.error.message
        });

      }

      if (!result.data) {

        return res.status(404).json({
          error:
            "Song not found."
        });

      }

      const song =
        result.data;

      const profile =
        song.artist_profiles ||
        {};

      const artistName =
        profile.performing_name ||
        profile.stage_name ||
        profile.artist_name ||
        "Unknown Artist";

      return res.json({

        success: true,

        song: {

          id:
            song.id,

          title:
            song.title,

          artist_name:
            artistName,

          artist:
            artistName,

          artist_profile_image:
            profile.profile_image_url ||
            null,

          genre:
            song.genre ||
            "Music",

          category:
            song.category ||
            "Music",

          cover_url:
            song.cover_url,

          audio_url:
            song.audio_url,

          status:
            song.status,

          price:
            pricing.amount,

          currency:
            pricing.currency,

          price_label:
            pricing.label

        }

      });

    } catch (error) {

      return res.status(500).json({
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   SONG COVER STATUS
========================================================= */

app.get(
  "/api/songs/:id/cover-status",
  async function(req, res) {

    try {

      const result =
        await supabase
          .from("songs")
          .select(
            "id,title,cover_url,status"
          )
          .eq(
            "id",
            req.params.id
          )
          .maybeSingle();

      if (result.error) {

        return res.status(500).json({
          error:
            result.error.message
        });

      }

      if (!result.data) {

        return res.status(404).json({
          error:
            "Song not found."
        });

      }

      return res.json({

        success: true,

        has_cover:
          !!result.data.cover_url,

        cover_url:
          result.data.cover_url,

        status:
          result.data.status

      });

    } catch (error) {

      return res.status(500).json({
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  function() {

    console.log(
      "PASONG API running on port " +
      PORT
    );

  }
);
