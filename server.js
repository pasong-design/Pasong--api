const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "apikey",
    "x-client-info"
  ]
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "2mb"
}));

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

const PORT =
  process.env.PORT || 3000;


/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://mtufczmjlkvycarxylgh.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );


/* =========================================================
   CLOUDINARY
========================================================= */

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME ||
  "vuehnvkp";

const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY ||
  "621955771344375";

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

  const sortedKeys =
    Object.keys(clean).sort();

  const stringToSign =
    sortedKeys
      .map(function (key) {
        return key + "=" + clean[key];
      })
      .join("&");

  return crypto
    .createHash("sha1")
    .update(
      stringToSign +
      CLOUDINARY_API_SECRET
    )
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

  const country =
    getCountry(req);

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

  } else if (
    eastAfrica.indexOf(country) !== -1
  ) {

    song = {
      amount: 1000,
      currency: "UGX",
      label: "UGX 1,000"
    };

  } else if (
    africa.indexOf(country) !== -1
  ) {

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
    country:
      country || "UNKNOWN",

    song:
      song,

    cover:
      cover,

    tip: {
      artistPercent: 70,
      pasongPercent: 30
    }
  };
}


/* =========================================================
   AUTH HELPER
========================================================= */

async function getAuthenticatedUser(req) {

  const authorization =
    req.headers.authorization || "";

  if (
    !authorization.startsWith("Bearer ")
  ) {
    return {
      user: null,
      error: "Missing authentication token"
    };
  }

  const accessToken =
    authorization
      .substring(7)
      .trim();

  if (!accessToken) {
    return {
      user: null,
      error: "Missing access token"
    };
  }

  const result =
    await supabase.auth.getUser(
      accessToken
    );

  if (
    result.error ||
    !result.data ||
    !result.data.user
  ) {

    return {
      user: null,
      error: "Invalid or expired login session"
    };

  }

  return {
    user: result.data.user,
    error: null
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
    cloudinary:
      CLOUDINARY_CLOUD_NAME
        ? "READY"
        : "MISSING",
    supabase:
      SUPABASE_URL
        ? "READY"
        : "MISSING"
  });

});


/* =========================================================
   PRICING
========================================================= */

app.get(
  "/api/pricing",
  function (req, res) {

    res.json({
      success: true,
      pricing:
        getPricing(req),
      country:
        getCountry(req)
    });

  }
);


/* =========================================================
   FIND PASONG USER BY EMAIL
   PRIVATE AUTHENTICATED ROUTE
========================================================= */

app.get(
  "/api/users/find",
  async function (req, res) {

    try {

      const auth =
        await getAuthenticatedUser(req);

      if (!auth.user) {

        return res.status(401).json({
          success: false,
          error: auth.error
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
          success: false,
          error:
            "Email is required"
        });

      }

      let foundUser = null;

      let page = 1;
      const perPage = 1000;

      while (page <= 10 && !foundUser) {

        const result =
          await supabase.auth.admin.listUsers({
            page: page,
            perPage: perPage
          });

        if (result.error) {

          console.error(
            "Find user error:",
            result.error
          );

          return res.status(500).json({
            success: false,
            error:
              result.error.message
          });

        }

        const users =
          result.data &&
          result.data.users
            ? result.data.users
            : [];

        foundUser =
          users.find(function (item) {

            return String(
              item.email || ""
            )
            .trim()
            .toLowerCase() === email;

          });

        if (
          users.length < perPage
        ) {
          break;
        }

        page++;
      }

      if (!foundUser) {

        return res.status(404).json({
          success: false,
          error:
            "No PASONG account found with that email"
        });

      }

      res.json({

        success: true,

        user_id:
          foundUser.id

      });

    } catch (error) {

      console.error(
        "User lookup exception:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   CLOUDINARY SIGNATURE
========================================================= */

app.get(
  "/api/cloudinary/signature",
  function (req, res) {

    try {

      const folder =
        req.query.folder ||
        "pasong-profiles";

      const publicId =
        req.query.public_id ||
        req.query.publicId ||
        "pasong_" + Date.now();

      const timestamp =
        Math.floor(
          Date.now() / 1000
        );

      const paramsToSign = {
        timestamp:
          timestamp,
        folder:
          folder,
        public_id:
          publicId
      };

      const signature =
        makeCloudinarySignature(
          paramsToSign
        );

      res.json({

        success: true,

        cloud_name:
          CLOUDINARY_CLOUD_NAME,

        cloudName:
          CLOUDINARY_CLOUD_NAME,

        api_key:
          CLOUDINARY_API_KEY,

        apiKey:
          CLOUDINARY_API_KEY,

        timestamp:
          timestamp,

        signature:
          signature,

        folder:
          folder,

        public_id:
          publicId,

        publicId:
          publicId,

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

      console.error(
        "Cloudinary signature error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


app.post(
  "/api/cloudinary/signature",
  function (req, res) {

    try {

      const folder =
        req.body.folder ||
        "pasong-profiles";

      const publicId =
        req.body.public_id ||
        req.body.publicId ||
        "pasong_" + Date.now();

      const timestamp =
        Math.floor(
          Date.now() / 1000
        );

      const paramsToSign = {
        timestamp:
          timestamp,
        folder:
          folder,
        public_id:
          publicId
      };

      const signature =
        makeCloudinarySignature(
          paramsToSign
        );

      res.json({

        success: true,

        cloud_name:
          CLOUDINARY_CLOUD_NAME,

        cloudName:
          CLOUDINARY_CLOUD_NAME,

        api_key:
          CLOUDINARY_API_KEY,

        apiKey:
          CLOUDINARY_API_KEY,

        timestamp:
          timestamp,

        signature:
          signature,

        folder:
          folder,

        public_id:
          publicId,

        publicId:
          publicId,

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

      console.error(
        "Cloudinary signature POST error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   SAVE ARTIST / ACCOUNT PROFILE
========================================================= */

app.post(
  "/api/artist-profile/save",
  async function (req, res) {

    try {

      const auth =
        await getAuthenticatedUser(req);

      if (!auth.user) {

        return res.status(401).json({
          success: false,
          error: auth.error
        });

      }

      const user =
        auth.user;

      const body =
        req.body || {};

      const realName =
        String(
          body.real_name || ""
        ).trim();

      const performingName =
        String(
          body.performing_name || ""
        ).trim();

      const mobileMoneyProvider =
        String(
          body.mobile_money_provider || ""
        ).trim();

      const mobileMoneyNumber =
        String(
          body.mobile_money_number || ""
        ).trim();

      const artistName =
        String(
          body.artist_name ||
          body.artistName ||
          performingName ||
          ""
        ).trim();

      const stageName =
        String(
          body.stage_name ||
          body.stageName ||
          performingName ||
          ""
        ).trim();

      const mobileNumber =
        String(
          body.mobile_number ||
          body.mobileNumber ||
          mobileMoneyNumber ||
          ""
        ).trim();

      if (!realName) {

        return res.status(400).json({
          success: false,
          error:
            "Real/legal name is required"
        });

      }

      if (!performingName) {

        return res.status(400).json({
          success: false,
          error:
            "Performing/stage name is required"
        });

      }

      if (!mobileMoneyProvider) {

        return res.status(400).json({
          success: false,
          error:
            "Select MTN or Airtel"
        });

      }

      if (
        mobileMoneyProvider !== "MTN" &&
        mobileMoneyProvider !== "Airtel"
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Invalid mobile-money provider"
        });

      }

      if (!mobileMoneyNumber) {

        return res.status(400).json({
          success: false,
          error:
            "Mobile money number is required"
        });

      }

      const profileData = {

        user_id:
          user.id,

        artist_name:
          artistName,

        stage_name:
          stageName,

        mobile_number:
          mobileNumber,

        real_name:
          realName,

        performing_name:
          performingName,

        mobile_money_provider:
          mobileMoneyProvider,

        mobile_money_number:
          mobileMoneyNumber,

        updated_at:
          new Date().toISOString()

      };

      const result =
        await supabase
          .from("artist_profiles")
          .upsert(
            profileData,
            {
              onConflict:
                "user_id"
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
          error:
            result.error.message,
          details:
            result.error.details || null
        });

      }

      res.json({

        success: true,

        message:
          "PASONG profile saved successfully",

        profile:
          result.data

      });

    } catch (error) {

      console.error(
        "Artist profile save error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   GET ARTIST PROFILE
========================================================= */

app.get(
  "/api/artist-profile",
  async function (req, res) {

    try {

      const userId =
        req.query.user_id ||
        req.query.userId;

      if (!userId) {

        return res.status(400).json({
          success: false,
          error:
            "user_id is required"
        });

      }

      const result =
        await supabase
          .from("artist_profiles")
          .select("*")
          .eq(
            "user_id",
            userId
          )
          .maybeSingle();

      if (result.error) {

        return res.status(500).json({
          success: false,
          error:
            result.error.message
        });

      }

      res.json({

        success: true,

        profile:
          result.data

      });

    } catch (error) {

      console.error(
        "Get artist profile error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   SONG UPLOAD SIGNATURE
========================================================= */

app.get(
  "/api/songs/sign-upload",
  function (req, res) {

    try {

      const title =
        req.query.title ||
        "song";

      const artistName =
        req.query.artist_name ||
        req.query.artistName ||
        "artist";

      const hasCover =
        String(
          req.query.has_cover || ""
        ).toLowerCase() ===
        "true";

      if (!hasCover) {

        return res.status(400).json({
          success: false,
          error:
            "Cover image is required"
        });

      }

      const safeTitle =
        String(title)
          .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          )
          .substring(
            0,
            60
          );

      const safeArtist =
        String(artistName)
          .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          )
          .substring(
            0,
            60
          );

      const folder =
        "pasong-songs/" +
        safeArtist;

      const timestamp =
        Math.floor(
          Date.now() / 1000
        );

      const audioPublicId =
        safeTitle +
        "_" +
        Date.now();

      const audioParams = {

        timestamp:
          timestamp,

        folder:
          folder,

        public_id:
          audioPublicId

      };

      const coverPublicId =
        safeTitle +
        "_cover_" +
        Date.now();

      const coverParams = {

        timestamp:
          timestamp,

        folder:
          folder,

        public_id:
          coverPublicId

      };

      res.json({

        success: true,

        audio: {

          cloud_name:
            CLOUDINARY_CLOUD_NAME,

          api_key:
            CLOUDINARY_API_KEY,

          timestamp:
            timestamp,

          signature:
            makeCloudinarySignature(
              audioParams
            ),

          folder:
            folder,

          public_id:
            audioPublicId,

          resource_type:
            "video"

        },

        cover: {

          cloud_name:
            CLOUDINARY_CLOUD_NAME,

          api_key:
            CLOUDINARY_API_KEY,

          timestamp:
            timestamp,

          signature:
            makeCloudinarySignature(
              coverParams
            ),

          folder:
            folder,

          public_id:
            coverPublicId,

          resource_type:
            "image"

        }

      });

    } catch (error) {

      console.error(
        "Song signature error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   GET SONGS
========================================================= */

app.get(
  "/api/songs",
  async function (req, res) {

    try {

      const result =
        await supabase
          .from("songs")
          .select("*")
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
          success: false,
          error:
            result.error.message
        });

      }

      const pricing =
        getPricing(req);

      const songs =
        (result.data || [])
          .map(function (song) {

            return {

              ...song,

              display_price:
                pricing.song.amount,

              display_currency:
                pricing.song.currency,

              display_price_label:
                pricing.song.label

            };

          });

      res.json({

        success: true,

        songs:
          songs,

        nextCursor:
          null

      });

    } catch (error) {

      console.error(
        "Get songs error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   SINGLE SONG
========================================================= */

app.get(
  "/api/songs/:id",
  async function (req, res) {

    try {

      const result =
        await supabase
          .from("songs")
          .select("*")
          .eq(
            "id",
            req.params.id
          )
          .maybeSingle();

      if (result.error) {

        return res.status(500).json({
          success: false,
          error:
            result.error.message
        });

      }

      if (!result.data) {

        return res.status(404).json({
          success: false,
          error:
            "Song not found"
        });

      }

      const pricing =
        getPricing(req);

      res.json({

        success: true,

        song: {

          ...result.data,

          display_price:
            pricing.song.amount,

          display_currency:
            pricing.song.currency,

          display_price_label:
            pricing.song.label

        }

      });

    } catch (error) {

      console.error(
        "Get single song error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   CREATE SONG
========================================================= */

app.post(
  "/api/songs/create",
  async function (req, res) {

    try {

      /* -----------------------------------------------------
         VERIFY LOGGED-IN USER
      ----------------------------------------------------- */

      const auth =
        await getAuthenticatedUser(req);

      if (!auth.user) {

        return res.status(401).json({
          success: false,
          error: auth.error
        });

      }

      const loggedInUser =
        auth.user;

      const body =
        req.body || {};


      /* -----------------------------------------------------
         BASIC FIELDS
      ----------------------------------------------------- */

      const title =
        String(
          body.title || ""
        ).trim();

      const audioUrl =
        String(
          body.audio_url ||
          body.audioUrl ||
          ""
        ).trim();

      const coverUrl =
        String(
          body.cover_url ||
          body.coverUrl ||
          ""
        ).trim();

      const genre =
        String(
          body.genre || ""
        ).trim() || null;

      const labelName =
        String(
          body.label_name ||
          body.label ||
          ""
        ).trim() || null;


      /* -----------------------------------------------------
         CREDIT ACCOUNTS
      ----------------------------------------------------- */

      const uploaderUserId =
        loggedInUser.id;

      const artistUserId =
        body.artist_user_id ||
        body.artist_id ||
        body.artistId ||
        loggedInUser.id;

      const producerUserId =
        body.producer_user_id ||
        null;

      const writerUserId =
        body.writer_user_id ||
        null;


      /* -----------------------------------------------------
         REQUIRED VALIDATION
      ----------------------------------------------------- */

      if (!title) {

        return res.status(400).json({
          success: false,
          error:
            "Song title is required"
        });

      }

      if (!audioUrl) {

        return res.status(400).json({
          success: false,
          error:
            "Audio URL is required"
        });

      }

      if (!coverUrl) {

        return res.status(400).json({
          success: false,
          error:
            "Cover image is required"
        });

      }


      /* -----------------------------------------------------
         VERIFY ARTIST ACCOUNT
      ----------------------------------------------------- */

      const accountIds = [];

      accountIds.push(
        artistUserId
      );

      if (producerUserId) {
        accountIds.push(
          producerUserId
        );
      }

      if (writerUserId) {
        accountIds.push(
          writerUserId
        );
      }


      const uniqueAccountIds =
        Array.from(
          new Set(accountIds)
        );


      const userChecks =
        await Promise.all(
          uniqueAccountIds.map(
            async function (userId) {

              const result =
                await supabase.auth.admin.getUserById(
                  userId
                );

              return {
                userId:
                  userId,
                result:
                  result
              };

            }
          )
        );


      for (
        let i = 0;
        i < userChecks.length;
        i++
      ) {

        const check =
          userChecks[i];

        if (
          check.result.error ||
          !check.result.data ||
          !check.result.data.user
        ) {

          return res.status(400).json({
            success: false,
            error:
              "One of the selected PASONG credit accounts does not exist"
          });

        }

      }


      /* -----------------------------------------------------
         DUPLICATE PROTECTION
         
         First protection layer:
         same title + same credited account.
         
         This prevents an artist/producer/writer from
         repeatedly uploading the same song under the
         same credit relationship.
      ----------------------------------------------------- */

      const existingResult =
        await supabase
          .from("songs")
          .select(
            "id, title, artist_user_id, producer_user_id, writer_user_id, uploader_user_id, status"
          )
          .ilike(
            "title",
            title
          );


      if (existingResult.error) {

        console.error(
          "Duplicate check error:",
          existingResult.error
        );

        return res.status(500).json({
          success: false,
          error:
            existingResult.error.message
        });

      }


      const existingSongs =
        existingResult.data || [];


      let duplicateSong = null;


      for (
        let i = 0;
        i < existingSongs.length;
        i++
      ) {

        const existing =
          existingSongs[i];


        const sameArtist =
          existing.artist_user_id &&
          existing.artist_user_id ===
          artistUserId;

        const sameProducer =
          producerUserId &&
          existing.producer_user_id &&
          existing.producer_user_id ===
          producerUserId;

        const sameWriter =
          writerUserId &&
          existing.writer_user_id &&
          existing.writer_user_id ===
          writerUserId;

        const sameUploader =
          existing.uploader_user_id &&
          existing.uploader_user_id ===
          uploaderUserId;


        if (
          sameArtist ||
          sameProducer ||
          sameWriter ||
          sameUploader
        ) {

          duplicateSong =
            existing;

          break;

        }

      }


      if (duplicateSong) {

        let ownerId =
          duplicateSong.artist_user_id ||
          duplicateSong.uploader_user_id;

        let ownerName =
          "another PASONG account";


        if (ownerId) {

          const profileResult =
            await supabase
              .from("artist_profiles")
              .select(
                "performing_name, stage_name, artist_name"
              )
              .eq(
                "user_id",
                ownerId
              )
              .maybeSingle();

          if (
            profileResult.data
          ) {

            ownerName =
              profileResult.data.performing_name ||
              profileResult.data.stage_name ||
              profileResult.data.artist_name ||
              ownerName;

          }

        }


        return res.status(409).json({

          success: false,

          duplicate: true,

          error:
            "This song already exists on PASONG under " +
            ownerName,

          existing_song_id:
            duplicateSong.id,

          existing_song_status:
            duplicateSong.status

        });

      }


      /* -----------------------------------------------------
         SERVER-CONTROLLED PRICE
      ----------------------------------------------------- */

      const pricing =
        getPricing(req);


      /*
        Database catalog price is kept in UGX 700 for
        compatibility with the current PASONG songs table.

        Actual customer display/payment price must always
        come from the backend pricing system.
      */

      const catalogPrice =
        700;

      const catalogCurrency =
        "UGX";


      /* -----------------------------------------------------
         INSERT SONG
      ----------------------------------------------------- */

      const insertData = {

        title:
          title,

        artist_id:
          artistUserId,

        uploader_user_id:
          uploaderUserId,

        artist_user_id:
          artistUserId,

        producer_user_id:
          producerUserId,

        writer_user_id:
          writerUserId,

        label_name:
          labelName,

        audio_url:
          audioUrl,

        cover_url:
          coverUrl,

        genre:
          genre,

        price:
          catalogPrice,

        currency:
          catalogCurrency,

        status:
          "approved"

      };


      const result =
        await supabase
          .from("songs")
          .insert(
            insertData
          )
          .select()
          .single();


      if (result.error) {

        console.error(
          "Create song error:",
          result.error
        );

        return res.status(500).json({
          success: false,
          error:
            result.error.message
        });

      }


      res.json({

        success: true,

        message:
          "Song uploaded successfully",

        song:
          result.data,

        pricing:
          pricing

      });

    } catch (error) {

      console.error(
        "Song create exception:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);


/* =========================================================
   COMPATIBILITY SONG POST
========================================================= */

app.post(
  "/api/songs",
  async function (req, res) {

    try {

      const auth =
        await getAuthenticatedUser(req);

      if (!auth.user) {

        return res.status(401).json({
          success: false,
          error: auth.error
        });

      }

      const body =
        req.body || {};

      const artistUserId =
        body.artist_user_id ||
        body.artist_id ||
        body.artistId ||
        auth.user.id;

      const result =
        await supabase
          .from("songs")
          .insert({

            title:
              body.title || "",

            artist_id:
              artistUserId,

            uploader_user_id:
              auth.user.id,

            artist_user_id:
              artistUserId,

            producer_user_id:
              body.producer_user_id ||
              null,

            writer_user_id:
              body.writer_user_id ||
              null,

            label_name:
              body.label_name ||
              body.label ||
              null,

            audio_url:
              body.audio_url ||
              body.audioUrl ||
              "",

            cover_url:
              body.cover_url ||
              body.coverUrl ||
              "",

            genre:
              body.genre ||
              null,

            price:
              700,

            currency:
              "UGX",

            status:
              "approved"

          })
          .select()
          .single();


      if (result.error) {

        return res.status(500).json({
          success: false,
          error:
            result.error.message
        });

      }


      res.json({

        success: true,

        song:
          result.data

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   COVER STATUS
========================================================= */

app.get(
  "/api/songs/:id/cover-status",
  async function (req, res) {

    try {

      const result =
        await supabase
          .from("songs")
          .select(
            "id, cover_url, status"
          )
          .eq(
            "id",
            req.params.id
          )
          .maybeSingle();


      if (result.error) {

        return res.status(500).json({
          success: false,
          error:
            result.error.message
        });

      }


      if (!result.data) {

        return res.status(404).json({
          success: false,
          error:
            "Song not found"
        });

      }


      res.json({

        success: true,

        hasCover:
          !!result.data.cover_url,

        coverUrl:
          result.data.cover_url,

        status:
          result.data.status

      });

    } catch (error) {

      res.status(500).json({
        success: false,
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
  function () {

    console.log(
      "PASONG API running on port " +
      PORT
    );

  }
);
