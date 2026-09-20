const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { v2: cloudinary } = require("cloudinary");
const multer = require("multer");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const PORT = process.env.PORT || 10000;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://mtufczmjlkvycarxylgh.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME || "vuehnvkp";

const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY || "621955771344375";

const CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ======================================================
// CLOUDINARY CONFIGURATION
// ======================================================

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

// ======================================================
// MULTER - COVER IMAGE UPLOADS
// ======================================================

const coverUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: function (req, file, callback) {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new Error(
          "Only JPG, JPEG, PNG and WEBP images are allowed."
        )
      );
    }
  }
});

// ======================================================
// BASIC
// ======================================================

app.get("/", function (req, res) {
  res.json({
    PASONG: "LIVE",
    upload: "READY",
    multi_artist: "READY",
    pricing: "READY",
    edit_song: "READY"
  });
});

app.get("/health", function (req, res) {
  res.json({
    status: "ok",
    service: "PASONG API"
  });
});

// ======================================================
// AUTHENTICATED USER
// ======================================================

async function getAuthenticatedUser(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.substring(7).trim();

  if (!token) {
    return null;
  }

  const result = await supabase.auth.getUser(token);

  if (result.error || !result.data.user) {
    return null;
  }

  return result.data.user;
}

// ======================================================
// COUNTRY / IP PRICING
// ======================================================

function getCountry(req) {
  const country =
    req.headers["x-vercel-ip-country"] ||
    req.headers["cf-ipcountry"] ||
    req.headers["x-country-code"] ||
    "";

  return String(country)
    .trim()
    .toUpperCase();
}

function getPricing(req) {
  const country = getCountry(req);

  // Uganda
  if (country === "UG") {
    return {
      amount: 700,
      currency: "UGX",
      label: "UGX 700"
    };
  }

  // East Africa
  const eastAfrica = [
    "KE",
    "TZ",
    "RW",
    "BI",
    "SS",
    "ET"
  ];

  if (eastAfrica.includes(country)) {
    return {
      amount: 1000,
      currency: "UGX",
      label: "UGX 1,000"
    };
  }

  // Other Africa
  const africa = [
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
    "SN",
    "CI",
    "SL",
    "LR",
    "GM",
    "GN",
    "EG",
    "MA",
    "DZ",
    "TN"
  ];

  if (africa.includes(country)) {
    return {
      amount: 0.57,
      currency: "USD",
      label: "$0.57"
    };
  }

  // United Kingdom
  if (country === "GB") {
    return {
      amount: 1,
      currency: "GBP",
      label: "£1"
    };
  }

  // Rest of world
  return {
    amount: 1,
    currency: "USD",
    label: "$1"
  };
}

// ======================================================
// COVER DESIGN PRICE
// ======================================================

function getCoverDesignPrice(req) {
  const country = getCountry(req);

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

app.get("/api/pricing", function (req, res) {
  const pricing = getPricing(req);

  res.json({
    country: getCountry(req),
    price: pricing.amount,
    currency: pricing.currency,
    label: pricing.label
  });
});

app.get("/api/cover-design-price", function (req, res) {
  const pricing = getCoverDesignPrice(req);

  res.json({
    country: getCountry(req),
    price: pricing.amount,
    currency: pricing.currency,
    label: pricing.label
  });
});

// ======================================================
// TIP SPLIT
// ======================================================

app.get("/api/tip-split", function (req, res) {
  res.json({
    artist_percent: 70,
    pasong_percent: 30
  });
});

// ======================================================
// COVER IMAGE UPLOAD
// ======================================================

app.post(
  "/api/upload/cover",
  coverUpload.single("file"),
  async function (req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No cover image was provided."
        });
      }

      if (!CLOUDINARY_API_SECRET) {
        console.error(
          "CLOUDINARY_API_SECRET is missing."
        );

        return res.status(500).json({
          error:
            "Cloudinary is not configured on the PASONG API."
        });
      }

      const folder = "pasong/covers";

      const result = await new Promise(
        function (resolve, reject) {
          const uploadStream =
            cloudinary.uploader.upload_stream(
              {
                folder: folder,
                resource_type: "image",
                transformation: [
                  {
                    quality: "auto",
                    fetch_format: "auto"
                  }
                ]
              },
              function (error, result) {
                if (error) {
                  reject(error);
                  return;
                }

                resolve(result);
              }
            );

          uploadStream.end(req.file.buffer);
        }
      );

      if (!result || !result.secure_url) {
        return res.status(500).json({
          error:
            "Cloudinary did not return an image URL."
        });
      }

      return res.json({
        success: true,
        secure_url: result.secure_url,
        public_id: result.public_id,
        resource_type: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height
      });
    } catch (error) {
      console.error(
        "Cover upload error:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Cover image upload failed."
      });
    }
  }
);

// ======================================================
// CLOUDINARY SIGNATURE
// ======================================================

function createCloudinarySignature(
  folder,
  timestamp
) {
  const stringToSign =
    "folder=" +
    folder +
    "&timestamp=" +
    timestamp;

  return crypto
    .createHash("sha1")
    .update(
      stringToSign +
      CLOUDINARY_API_SECRET
    )
    .digest("hex");
}

app.post(
  "/api/cloudinary/signature",
  async function (req, res) {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Authentication required."
        });
      }

      if (!CLOUDINARY_API_SECRET) {
        return res.status(500).json({
          error:
            "Cloudinary API secret is not configured."
        });
      }

      const folder =
        req.body.folder ||
        "pasong-songs";

      const timestamp =
        Math.floor(Date.now() / 1000);

      const signature =
        createCloudinarySignature(
          folder,
          timestamp
        );

      return res.json({
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
      console.error(
        "Cloudinary signature error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not create Cloudinary signature."
      });
    }
  }
);

app.get(
  "/api/cloudinary/signature",
  async function (req, res) {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Authentication required."
        });
      }

      if (!CLOUDINARY_API_SECRET) {
        return res.status(500).json({
          error:
            "Cloudinary API secret is not configured."
        });
      }

      const folder =
        req.query.folder ||
        "pasong-songs";

      const timestamp =
        Math.floor(Date.now() / 1000);

      const signature =
        createCloudinarySignature(
          folder,
          timestamp
        );

      return res.json({
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
      console.error(
        "Cloudinary signature error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not create Cloudinary signature."
      });
    }
  }
);

// ======================================================
// FIND PASONG USER BY EMAIL
// ======================================================

app.get(
  "/api/users/find",
  async function (req, res) {
    try {
      const loggedInUser =
        await getAuthenticatedUser(req);

      if (!loggedInUser) {
        return res.status(401).json({
          error:
            "Authentication required."
        });
      }

      const email = String(
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

      const found =
        result.data.users.find(
          function (user) {
            return (
              String(user.email || "")
                .toLowerCase() ===
              email
            );
          }
        );

      if (!found) {
        return res.status(404).json({
          error:
            "No PASONG account was found for " +
            email
        });
      }

      return res.json({
        user_id: found.id,
        email: found.email
      });
    } catch (error) {
      console.error(
        "User find error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not find PASONG account."
      });
    }
  }
);

// ======================================================
// ARTIST PROFILE SAVE
// ======================================================

app.post(
  "/api/artist-profile/save",
  async function (req, res) {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error:
            "Authentication required."
        });
      }

      const body = req.body || {};

      const existingResult =
        await supabase
          .from("artist_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

      if (
        existingResult.error &&
        existingResult.error.code !==
          "PGRST116"
      ) {
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

      const mobileNumber =
        String(
          body.mobile_money_number ||
          body.mobile_number ||
          existing.mobile_money_number ||
          existing.mobile_number ||
          ""
        ).trim();

      const provider =
        String(
          body.mobile_money_provider ||
          existing.mobile_money_provider ||
          ""
        ).trim();

      const profileImage =
        body.profile_image_url !==
        undefined
          ? body.profile_image_url
          : existing.profile_image_url ||
            null;

      if (!performingName) {
        return res.status(400).json({
          error:
            "Performing name is required."
        });
      }

      const data = {
        user_id: user.id,
        artist_name: performingName,
        stage_name: performingName,
        performing_name: performingName,
        real_name:
          realName || null,
        mobile_number:
          mobileNumber || null,
        mobile_money_number:
          mobileNumber || null,
        mobile_money_provider:
          provider || null,
        profile_image_url:
          profileImage
      };

      const result =
        await supabase
          .from("artist_profiles")
          .upsert(data, {
            onConflict: "user_id"
          })
          .select()
          .single();

      if (result.error) {
        console.error(
          "Profile save error:",
          result.error
        );

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
      console.error(
        "Profile save error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not save artist profile."
      });
    }
  }
);

// ======================================================
// GET ARTIST PROFILE
// ======================================================

app.get(
  "/api/artist-profile",
  async function (req, res) {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error:
            "Authentication required."
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
        profile:
          result.data || null
      });
    } catch (error) {
      return res.status(500).json({
        error:
          "Could not load artist profile."
      });
    }
  }
);

// ======================================================
// SONG UPLOAD SIGN CHECK
// ======================================================

app.get(
  "/api/songs/sign-upload",
  async function (req, res) {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error:
          "Authentication required."
      });
    }

    const hasCover =
      String(
        req.query.has_cover || ""
      ).toLowerCase() === "true";

    if (!hasCover) {
      return res.status(400).json({
        error:
          "Cover image is required before uploading a song."
      });
    }

    return res.json({
      allowed: true
    });
  }
);

// ======================================================
// HELPER: VALIDATE PASONG USER
// ======================================================

async function validateUserId(userId) {
  if (!userId) {
    return null;
  }

  const result =
    await supabase.auth.admin.getUserById(
      userId
    );

  if (
    result.error ||
    !result.data ||
    !result.data.user
  ) {
    return null;
  }

  return result.data.user;
}

// ======================================================
// HELPER: GET ARTIST PROFILE
// ======================================================

async function getArtistProfile(userId) {
  if (!userId) {
    return null;
  }

  const result =
    await supabase
      .from("artist_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

  if (result.error) {
    return null;
  }

  return result.data || null;
}

// ======================================================
// HELPER: NORMALIZE ARTIST IDS
// ======================================================

function normalizeArtistIds(
  body,
  loggedInUserId
) {
  let ids = [];

  if (Array.isArray(body.artist_user_ids)) {
    ids =
      body.artist_user_ids
        .map(function (id) {
          return String(id || "").trim();
        })
        .filter(Boolean);
  }

  if (
    ids.length === 0 &&
    typeof body.artist_user_ids ===
      "string"
  ) {
    ids =
      body.artist_user_ids
        .split(",")
        .map(function (id) {
          return String(id || "").trim();
        })
        .filter(Boolean);
  }

  if (
    ids.length === 0 &&
    body.artist_user_id
  ) {
    ids = [
      String(
        body.artist_user_id
      ).trim()
    ];
  }

  if (ids.length === 0) {
    ids = [loggedInUserId];
  }

  ids = Array.from(
    new Set(ids)
  );

  return ids;
}

// ======================================================
// HELPER: ARTIST SHARES
// ======================================================

function calculateArtistShares(
  artistIds
) {
  const count = artistIds.length;

  if (count <= 0) {
    return [];
  }

  const total = 40.0;

  const shares = [];

  let used = 0;

  for (
    let i = 0;
    i < count;
    i++
  ) {
    if (i === count - 1) {
      const last = Number(
        (
          total -
          used
        ).toFixed(4)
      );

      shares.push(last);
    } else {
      const share = Number(
        (
          total / count
        ).toFixed(4)
      );

      shares.push(share);

      used = Number(
        (
          used +
          share
        ).toFixed(4)
      );
    }
  }

  return shares;
}

// ======================================================
// CREATE SONG
// ======================================================

app.post(
  "/api/songs/create",
  async function (req, res) {
    try {
      const loggedInUser =
        await getAuthenticatedUser(req);

      if (!loggedInUser) {
        return res.status(401).json({
          error:
            "Missing authentication token."
        });
      }

      const body = req.body || {};

      const title =
        String(
          body.title || ""
        ).trim();

      const audioUrl =
        String(
          body.audio_url || ""
        ).trim();

      const coverUrl =
        String(
          body.cover_url || ""
        ).trim();

      const genre =
        String(
          body.genre ||
          body.category ||
          "Music"
        ).trim();

      const labelName =
        String(
          body.label_name ||
          body.label ||
          ""
        ).trim();

      const writerUserId =
        body.writer_user_id
          ? String(
              body.writer_user_id
            ).trim()
          : null;

      const producerUserId =
        body.producer_user_id
          ? String(
              body.producer_user_id
            ).trim()
          : null;

      if (!title) {
        return res.status(400).json({
          error:
            "Song title is required."
        });
      }

      if (!audioUrl) {
        return res.status(400).json({
          error:
            "Audio URL is required."
        });
      }

      if (!coverUrl) {
        return res.status(400).json({
          error:
            "Cover image is required."
        });
      }

      const artistIds =
        normalizeArtistIds(
          body,
          loggedInUser.id
        );

      if (artistIds.length === 0) {
        return res.status(400).json({
          error:
            "At least one performing artist is required."
        });
      }

      const artistUsers = [];

      for (
        let i = 0;
        i < artistIds.length;
        i++
      ) {
        const artistUser =
          await validateUserId(
            artistIds[i]
          );

        if (!artistUser) {
          return res.status(400).json({
            error:
              "One of the performing artist PASONG accounts could not be found."
          });
        }

        const profile =
          await getArtistProfile(
            artistIds[i]
          );

        if (!profile) {
          return res.status(400).json({
            error:
              "Performing artist " +
              (
                artistUser.email ||
                artistIds[i]
              ) +
              " has not created an artist profile yet."
          });
        }

        artistUsers.push({
          user: artistUser,
          profile: profile
        });
      }

      if (producerUserId) {
        const producer =
          await validateUserId(
            producerUserId
          );

        if (!producer) {
          return res.status(400).json({
            error:
              "Producer PASONG account could not be found."
          });
        }
      }

      if (writerUserId) {
        const writer =
          await validateUserId(
            writerUserId
          );

        if (!writer) {
          return res.status(400).json({
            error:
              "Writer PASONG account could not be found."
          });
        }
      }

      const primaryArtistUserId =
        artistIds[0];

      const primaryArtistProfile =
        artistUsers[0].profile;

      const primaryArtistProfileId =
        primaryArtistProfile.id;

      const duplicateTitle =
        await supabase
          .from("songs")
          .select(
            "id,title,artist_id"
          )
          .ilike(
            "title",
            title
          )
          .limit(1);

      if (
        duplicateTitle.data &&
        duplicateTitle.data.length > 0
      ) {
        return res.status(409).json({
          error:
            "A song with this title already exists on PASONG. If this is your song, please use the existing song record or contact Admin."
        });
      }

      const pricing =
        getPricing(req);

      const insertData = {
        artist_id:
          primaryArtistProfileId,

        artist_user_id:
          primaryArtistUserId,

        uploader_user_id:
          loggedInUser.id,

        producer_user_id:
          producerUserId,

        writer_user_id:
          writerUserId,

        label_name:
          labelName || null,

        title: title,

        price:
          pricing.amount,

        currency:
          pricing.currency,

        status:
          "approved",

        cover_url:
          coverUrl,

        audio_url:
          audioUrl,

        artist_count:
          artistIds.length
      };

      const songResult =
        await supabase
          .from("songs")
          .insert(insertData)
          .select()
          .single();

      if (songResult.error) {
        console.error(
          "Song insert error:",
          songResult.error
        );

        return res.status(500).json({
          error:
            songResult.error.message
        });
      }

      const song =
        songResult.data;

      const artistShares =
        calculateArtistShares(
          artistIds
        );

      const artistRows =
        artistIds.map(
          function (
            artistUserId,
            index
          ) {
            return {
              song_id:
                song.id,

              artist_user_id:
                artistUserId,

              artist_order:
                index + 1,

              artist_share_percent:
                artistShares[index]
            };
          }
        );

      const artistRowsResult =
        await supabase
          .from("song_artists")
          .insert(artistRows);

      if (artistRowsResult.error) {
        console.error(
          "Song artists insert error:",
          artistRowsResult.error
        );

        await supabase
          .from("songs")
          .delete()
          .eq(
            "id",
            song.id
          );

        return res.status(500).json({
          error:
            "Song was not saved because artist credits could not be created: " +
            artistRowsResult.error.message
        });
      }

      return res.status(201).json({
        success: true,

        message:
          "Song uploaded successfully.",

        song: song,

        artists:
          artistIds.map(
            function (
              artistUserId,
              index
            ) {
              const info =
                artistUsers[index];

              const profile =
                info.profile;

              return {
                user_id:
                  artistUserId,

                name:
                  profile.performing_name ||
                  profile.stage_name ||
                  profile.artist_name ||
                  info.user.email ||
                  "Unknown Artist",

                share_percent:
                  artistShares[index]
              };
            }
          ),

        pricing:
          pricing
      });
    } catch (error) {
      console.error(
        "Song creation error:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Could not create song."
      });
    }
  }
);

// ======================================================
// OLD / COMPATIBILITY SONG POST
// ======================================================

app.post(
  "/api/songs",
  async function (req, res) {
    try {
      const loggedInUser =
        await getAuthenticatedUser(req);

      if (!loggedInUser) {
        return res.status(401).json({
          error:
            "Missing authentication token."
        });
      }

      const body = req.body || {};

      const title =
        String(
          body.title || ""
        ).trim();

      const audioUrl =
        String(
          body.audio_url || ""
        ).trim();

      const coverUrl =
        String(
          body.cover_url || ""
        ).trim();

      if (!title) {
        return res.status(400).json({
          error:
            "Song title is required."
        });
      }

      if (!audioUrl) {
        return res.status(400).json({
          error:
            "Audio URL is required."
        });
      }

      if (!coverUrl) {
        return res.status(400).json({
          error:
            "Cover image is required."
        });
      }

      const artistIds =
        normalizeArtistIds(
          body,
          loggedInUser.id
        );

      const artistUsers = [];

      for (
        let i = 0;
        i < artistIds.length;
        i++
      ) {
        const artistUser =
          await validateUserId(
            artistIds[i]
          );

        if (!artistUser) {
          return res.status(400).json({
            error:
              "Performing artist account could not be found."
          });
        }

        const profile =
          await getArtistProfile(
            artistIds[i]
          );

        if (!profile) {
          return res.status(400).json({
            error:
              "Performing artist profile not found."
          });
        }

        artistUsers.push({
          user: artistUser,
          profile: profile
        });
      }

      const primaryProfile =
        artistUsers[0].profile;

      const pricing =
        getPricing(req);

      const songResult =
        await supabase
          .from("songs")
          .insert({
            artist_id:
              primaryProfile.id,

            artist_user_id:
              artistIds[0],

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
              body.label ||
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
              audioUrl,

            artist_count:
              artistIds.length
          })
          .select()
          .single();

      if (songResult.error) {
        return res.status(500).json({
          error:
            songResult.error.message
        });
      }

      const shares =
        calculateArtistShares(
          artistIds
        );

      const rows =
        artistIds.map(
          function (
            artistUserId,
            index
          ) {
            return {
              song_id:
                songResult.data.id,

              artist_user_id:
                artistUserId,

              artist_order:
                index + 1,

              artist_share_percent:
                shares[index]
            };
          }
        );

      const credits =
        await supabase
          .from("song_artists")
          .insert(rows);

      if (credits.error) {
        await supabase
          .from("songs")
          .delete()
          .eq(
            "id",
            songResult.data.id
          );

        return res.status(500).json({
          error:
            credits.error.message
        });
      }

      return res.status(201).json({
        success: true,

        message:
          "Song uploaded successfully.",

        song:
          songResult.data,

        artists:
          artistIds.map(
            function (
              id,
              index
            ) {
              const profile =
                artistUsers[index]
                  .profile;

              return {
                user_id: id,

                name:
                  profile.performing_name ||
                  profile.stage_name ||
                  profile.artist_name ||
                  "Unknown Artist",

                share_percent:
                  shares[index]
              };
            }
          )
      });
    } catch (error) {
      console.error(
        "Compatibility song error:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Could not create song."
      });
    }
  }
);

// ======================================================
// GET APPROVED SONGS
// ======================================================

app.get(
  "/api/songs",
  async function (req, res) {
    try {
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
        console.error(
          "Songs list error:",
          result.error
        );

        return res.status(500).json({
          error:
            result.error.message
        });
      }

      const songs =
        result.data || [];

      const songIds =
        songs.map(
          function (song) {
            return song.id;
          }
        );

      let artistCredits = [];

      if (songIds.length > 0) {
        const creditsResult =
          await supabase
            .from("song_artists")
            .select(
              "song_id,artist_user_id,artist_order,artist_share_percent"
            )
            .in(
              "song_id",
              songIds
            )
            .order(
              "artist_order",
              {
                ascending: true
              }
            );

        if (!creditsResult.error) {
          artistCredits =
            creditsResult.data ||
            [];
        }
      }

      const artistUserIds =
        Array.from(
          new Set(
            artistCredits.map(
              function (row) {
                return row.artist_user_id;
              }
            )
          )
        );

      let profiles = [];

      if (
        artistUserIds.length > 0
      ) {
        const profilesResult =
          await supabase
            .from("artist_profiles")
            .select(`
              user_id,
              artist_name,
              stage_name,
              performing_name,
              profile_image_url
            `)
            .in(
              "user_id",
              artistUserIds
            );

        if (!profilesResult.error) {
          profiles =
            profilesResult.data ||
            [];
        }
      }

      const pricing =
        getPricing(req);

      const formattedSongs =
        songs.map(
          function (song) {
            const credits =
              artistCredits.filter(
                function (row) {
                  return (
                    row.song_id ===
                    song.id
                  );
                }
              );

            const artists =
              credits.map(
                function (row) {
                  const profile =
                    profiles.find(
                      function (p) {
                        return (
                          p.user_id ===
                          row.artist_user_id
                        );
                      }
                    );

                  const name =
                    profile &&
                    (
                      profile.performing_name ||
                      profile.stage_name ||
                      profile.artist_name
                    )
                      ? (
                          profile.performing_name ||
                          profile.stage_name ||
                          profile.artist_name
                        )
                      : "Unknown Artist";

                  return {
                    user_id:
                      row.artist_user_id,

                    name:
                      name,

                    profile_image_url:
                      profile
                        ? profile.profile_image_url
                        : null,

                    share_percent:
                      row.artist_share_percent,

                    order:
                      row.artist_order
                  };
                }
              );

            let displayArtist =
              "Unknown Artist";

            if (
              artists.length > 0
            ) {
              displayArtist =
                artists
                  .map(
                    function (a) {
                      return a.name;
                    }
                  )
                  .join(", ");
            } else if (
              song.artist_profiles
            ) {
              displayArtist =
                song.artist_profiles
                  .performing_name ||
                song.artist_profiles
                  .stage_name ||
                song.artist_profiles
                  .artist_name ||
                "Unknown Artist";
            }

            return {
              ...song,

              artist:
                displayArtist,

              artist_name:
                displayArtist,

              artists:
                artists,

              artist_count:
                artists.length ||
                song.artist_count ||
                1,

              display_price:
                pricing.amount,

              display_currency:
                pricing.currency,

              display_price_label:
                pricing.label
            };
          }
        );

      return res.json({
        songs:
          formattedSongs,

        nextCursor:
          null,

        pricing:
          pricing
      });
    } catch (error) {
      console.error(
        "Songs API error:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Could not load songs."
      });
    }
  }
);

// ======================================================
// GET SINGLE SONG
// ======================================================

app.get(
  "/api/songs/:id",
  async function (req, res) {
    try {
      const songId =
        req.params.id;

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

      const creditsResult =
        await supabase
          .from("song_artists")
          .select(
            "song_id,artist_user_id,artist_order,artist_share_percent"
          )
          .eq(
            "song_id",
            song.id
          )
          .order(
            "artist_order",
            {
              ascending: true
            }
          );

      const credits =
        creditsResult.data ||
        [];

      const ids =
        credits.map(
          function (row) {
            return row.artist_user_id;
          }
        );

      let profiles = [];

      if (ids.length > 0) {
        const profileResult =
          await supabase
            .from("artist_profiles")
            .select(`
              user_id,
              artist_name,
              stage_name,
              performing_name,
              profile_image_url
            `)
            .in(
              "user_id",
              ids
            );

        if (!profileResult.error) {
          profiles =
            profileResult.data ||
            [];
        }
      }

      const artists =
        credits.map(
          function (row) {
            const profile =
              profiles.find(
                function (p) {
                  return (
                    p.user_id ===
                    row.artist_user_id
                  );
                }
              );

            return {
              user_id:
                row.artist_user_id,

              name:
                profile
                  ? (
                      profile.performing_name ||
                      profile.stage_name ||
                      profile.artist_name ||
                      "Unknown Artist"
                    )
                  : "Unknown Artist",

              profile_image_url:
                profile
                  ? profile.profile_image_url
                  : null,

              share_percent:
                row.artist_share_percent,

              order:
                row.artist_order
            };
          }
        );

      const pricing =
        getPricing(req);

      const displayArtist =
        artists.length > 0
          ? artists
              .map(
                function (a) {
                  return a.name;
                }
              )
              .join(", ")
          : (
              song.artist_profiles &&
              (
                song.artist_profiles
                  .performing_name ||
                song.artist_profiles
                  .stage_name ||
                song.artist_profiles
                  .artist_name
              )
            ) ||
            "Unknown Artist";

      return res.json({
        song: {
          ...song,

          artist:
            displayArtist,

          artist_name:
            displayArtist,

          artists:
            artists,

          artist_count:
            artists.length ||
            song.artist_count ||
            1,

          display_price:
            pricing.amount,

          display_currency:
            pricing.currency,

          display_price_label:
            pricing.label
        },

        pricing:
          pricing
      });
    } catch (error) {
      console.error(
        "Single song error:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Could not load song."
      });
    }
  }
);

// ======================================================
// COVER STATUS
// ======================================================

app.get(
  "/api/songs/:id/cover-status",
  async function (req, res) {
    try {
      const result =
        await supabase
          .from("songs")
          .select(
            "id,cover_url,status"
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
        song_id:
          result.data.id,

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
          "Could not check cover status."
      });
    }
  }
);

// ======================================================
// EDIT SONG TITLE
// ======================================================

app.patch(
  "/api/songs/:id/title",
  async function (req, res) {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error:
            "Authentication required."
        });
      }

      const songId =
        String(
          req.params.id || ""
        ).trim();

      const newTitle =
        String(
          req.body.title || ""
        ).trim();

      if (!songId) {
        return res.status(400).json({
          error:
            "Song ID is required."
        });
      }

      if (!newTitle) {
        return res.status(400).json({
          error:
            "Song title is required."
        });
      }

      if (newTitle.length > 150) {
        return res.status(400).json({
          error:
            "Song title is too long."
        });
      }

      const songResult =
        await supabase
          .from("songs")
          .select(
            "id,title,uploader_user_id,artist_user_id"
          )
          .eq(
            "id",
            songId
          )
          .maybeSingle();

      if (songResult.error) {
        return res.status(500).json({
          error:
            songResult.error.message
        });
      }

      if (!songResult.data) {
        return res.status(404).json({
          error:
            "Song not found."
        });
      }

      const song =
        songResult.data;

      if (
        song.uploader_user_id !==
        user.id
      ) {
        return res.status(403).json({
          error:
            "You can only edit songs uploaded by your account."
        });
      }

      const duplicateResult =
        await supabase
          .from("songs")
          .select(
            "id,title"
          )
          .ilike(
            "title",
            newTitle
          )
          .neq(
            "id",
            songId
          )
          .limit(1);

      if (duplicateResult.error) {
        return res.status(500).json({
          error:
            duplicateResult.error.message
        });
      }

      if (
        duplicateResult.data &&
        duplicateResult.data.length > 0
      ) {
        return res.status(409).json({
          error:
            "Another song with this title already exists on PASONG."
        });
      }

      const updateResult =
        await supabase
          .from("songs")
          .update({
            title:
              newTitle
          })
          .eq(
            "id",
            songId
          )
          .select()
          .single();

      if (updateResult.error) {
        console.error(
          "Song title update error:",
          updateResult.error
        );

        return res.status(500).json({
          error:
            updateResult.error.message
        });
      }

      return res.json({
        success:
          true,

        message:
          "Song title updated successfully.",

        song:
          updateResult.data
      });
    } catch (error) {
      console.error(
        "Edit title error:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Could not update song title."
      });
    }
  }
);

// ======================================================
// LISTEN / PREVIEW
// ======================================================

app.post(
  "/api/songs/:id/listen",
  async function (req, res) {
    try {
      const songId =
        req.params.id;

      const songResult =
        await supabase
          .from("songs")
          .select(
            "id,status"
          )
          .eq(
            "id",
            songId
          )
          .maybeSingle();

      if (
        songResult.error ||
        !songResult.data
      ) {
        return res.status(404).json({
          error:
            "Song not found."
        });
      }

      if (
        songResult.data.status !==
        "approved"
      ) {
        return res.status(403).json({
          error:
            "Song is not available."
        });
      }

      const user =
        await getAuthenticatedUser(req);

      const insertData = {
        song_id:
          songId
      };

      if (user) {
        insertData.user_id =
          user.id;
      }

      const result =
        await supabase
          .from("song_plays")
          .insert(
            insertData
          );

      if (result.error) {
        console.error(
          "Listen tracking error:",
          result.error
        );
      }

      return res.json({
        success: true
      });
    } catch (error) {
      return res.json({
        success: true
      });
    }
  }
);

// ======================================================
// ROYALTY CALCULATION HELPER
// ======================================================

function calculateRoyaltyAmounts(
  saleAmount,
  artistRows
) {
  const artistPool =
    saleAmount * 0.40;

  const producerAmount =
    saleAmount * 0.20;

  const writerAmount =
    saleAmount * 0.15;

  const pasongAmount =
    saleAmount * 0.25;

  const results = [];

  let artistUsed = 0;

  for (
    let i = 0;
    i < artistRows.length;
    i++
  ) {
    let amount;

    if (
      i ===
      artistRows.length - 1
    ) {
      amount = Number(
        (
          artistPool -
          artistUsed
        ).toFixed(2)
      );
    } else {
      amount = Number(
        (
          artistPool *
          (
            Number(
              artistRows[i]
                .artist_share_percent
            ) / 40
          )
        ).toFixed(2)
      );

      artistUsed = Number(
        (
          artistUsed +
          amount
        ).toFixed(2)
      );
    }

    results.push({
      recipient_user_id:
        artistRows[i]
          .artist_user_id,

      recipient_type:
        "artist",

      percentage:
        Number(
          artistRows[i]
            .artist_share_percent
        ),

      amount:
        amount
    });
  }

  return {
    artist:
      results,

    producer:
      producerAmount,

    writer:
      writerAmount,

    pasong:
      pasongAmount
  };
}

// ======================================================
// ROYALTY PREVIEW
// ======================================================

app.get(
  "/api/songs/:id/royalty-preview",
  async function (req, res) {
    try {
      const songId =
        req.params.id;

      const songResult =
        await supabase
          .from("songs")
          .select(
            "id,price,currency,producer_user_id,writer_user_id"
          )
          .eq(
            "id",
            songId
          )
          .maybeSingle();

      if (
        songResult.error ||
        !songResult.data
      ) {
        return res.status(404).json({
          error:
            "Song not found."
        });
      }

      const creditsResult =
        await supabase
          .from("song_artists")
          .select(
            "artist_user_id,artist_share_percent,artist_order"
          )
          .eq(
            "song_id",
            songId
          )
          .order(
            "artist_order",
            {
              ascending: true
            }
          );

      if (creditsResult.error) {
        return res.status(500).json({
          error:
            creditsResult.error.message
        });
      }

      const credits =
        creditsResult.data ||
        [];

      const calculation =
        calculateRoyaltyAmounts(
          Number(
            songResult.data.price
          ),
          credits
        );

      return res.json({
        song_id:
          songId,

        sale_amount:
          Number(
            songResult.data.price
          ),

        currency:
          songResult.data.currency,

        artist_pool_percent:
          40,

        producer_percent:
          20,

        writer_percent:
          15,

        pasong_percent:
          25,

        calculation:
          calculation
      });
    } catch (error) {
      return res.status(500).json({
        error:
          error.message ||
          "Could not calculate royalties."
      });
    }
  }
);

// ======================================================
// EARNINGS
// ======================================================

app.get(
  "/api/earnings",
  async function (req, res) {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error:
            "Authentication required."
        });
      }

      const result =
        await supabase
          .from("royalty_ledger")
          .select(`
            id,
            recipient_type,
            song_id,
            sale_reference,
            sale_amount,
            currency,
            percentage,
            amount,
            entry_type,
            status,
            withdrawal_id,
            created_at
          `)
          .eq(
            "recipient_user_id",
            user.id
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );

      if (result.error) {
        console.error(
          "Earnings ledger error:",
          result.error
        );

        return res.status(500).json({
          error:
            "Failed to load earnings."
        });
      }

      const entries =
        result.data || [];

      let availableBalance =
        0;

      for (
        let i = 0;
        i < entries.length;
        i++
      ) {
        const entry =
          entries[i];

        const amount =
          Number(
            entry.amount || 0
          );

        if (
          entry.entry_type ===
            "credit" &&
          entry.status ===
            "available"
        ) {
          availableBalance +=
            amount;
        }

        if (
          entry.entry_type ===
          "debit"
        ) {
          availableBalance -=
            amount;
        }
      }

      availableBalance =
        Number(
          availableBalance.toFixed(2)
        );

      return res.json({
        success:
          true,

        currency:
          "UGX",

        available_balance:
          availableBalance,

        entries:
          entries
      });
    } catch (error) {
      console.error(
        "Earnings endpoint error:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to load earnings."
      });
    }
  }
);

// ======================================================
// PAYMENT COMPLETION
// SECURE SERVER-TO-SERVER ENDPOINT
// ======================================================

function safeSecretCompare(a, b) {
  const aBuffer =
    Buffer.from(
      String(a || "")
    );

  const bBuffer =
    Buffer.from(
      String(b || "")
    );

  if (
    aBuffer.length !==
    bBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer
  );
}

app.post(
  "/api/payments/complete",
  async function (req, res) {
    try {
      // --------------------------------------------------
      // SECURITY
      // --------------------------------------------------

      const expectedSecret =
        process.env.PASONG_PAYMENT_SECRET;

      const receivedSecret =
        req.headers[
          "x-pasong-payment-secret"
        ];

      if (
        !expectedSecret ||
        !safeSecretCompare(
          receivedSecret,
          expectedSecret
        )
      ) {
        return res.status(401).json({
          error:
            "Unauthorized payment completion request."
        });
      }

      // --------------------------------------------------
      // REQUEST DATA
      // --------------------------------------------------

      const body =
        req.body || {};

      const buyerId =
        String(
          body.buyer_id || ""
        ).trim();

      const songId =
        String(
          body.song_id || ""
        ).trim();

      const transactionId =
        String(
          body.transaction_id || ""
        ).trim();

      const externalReference =
        String(
          body.external_reference ||
          ""
        ).trim();

      const provider =
        String(
          body.provider ||
          "MTN MoMo"
        ).trim();

      const paidAmount =
        Number(
          body.amount || 0
        );

      const paidCurrency =
        String(
          body.currency || ""
        )
          .trim()
          .toUpperCase();

      const paymentStatus =
        String(
          body.payment_status ||
          ""
        )
          .trim()
          .toUpperCase();

      // --------------------------------------------------
      // VALIDATION
      // --------------------------------------------------

      if (!buyerId) {
        return res.status(400).json({
          error:
            "buyer_id is required."
        });
      }

      if (!songId) {
        return res.status(400).json({
          error:
            "song_id is required."
        });
      }

      if (!transactionId) {
        return res.status(400).json({
          error:
            "transaction_id is required."
        });
      }

      if (!externalReference) {
        return res.status(400).json({
          error:
            "external_reference is required."
        });
      }

      if (
        paymentStatus !==
        "SUCCESSFUL"
      ) {
        return res.status(400).json({
          error:
            "Payment has not been verified as successful."
        });
      }

      if (
        !Number.isFinite(
          paidAmount
        ) ||
        paidAmount <= 0
      ) {
        return res.status(400).json({
          error:
            "Invalid payment amount."
        });
      }

      if (!paidCurrency) {
        return res.status(400).json({
          error:
            "Payment currency is required."
        });
      }

      // --------------------------------------------------
      // VERIFY BUYER
      // --------------------------------------------------

      const buyer =
        await validateUserId(
          buyerId
        );

      if (!buyer) {
        return res.status(400).json({
          error:
            "Buyer PASONG account could not be found."
        });
      }

      // --------------------------------------------------
      // VERIFY SONG
      // --------------------------------------------------

      const songResult =
        await supabase
          .from("songs")
          .select(`
            id,
            title,
            price,
            currency,
            status,
            artist_user_id,
            producer_user_id,
            writer_user_id
          `)
          .eq(
            "id",
            songId
          )
          .maybeSingle();

      if (songResult.error) {
        console.error(
          "Payment song lookup error:",
          songResult.error
        );

        return res.status(500).json({
          error:
            "Could not verify the song."
        });
      }

      if (!songResult.data) {
        return res.status(404).json({
          error:
            "Song not found."
        });
      }

      const song =
        songResult.data;

      if (
        song.status !==
        "approved"
      ) {
        return res.status(403).json({
          error:
            "This song is not available for purchase."
        });
      }

      // --------------------------------------------------
      // SERVER-SIDE PRICE VERIFICATION
      // --------------------------------------------------

      const expectedPrice =
        Number(
          song.price || 0
        );

      const expectedCurrency =
        String(
          song.currency || ""
        )
          .trim()
          .toUpperCase();

      if (
        paidAmount !==
          expectedPrice ||
        paidCurrency !==
          expectedCurrency
      ) {
        return res.status(400).json({
          error:
            "Payment amount or currency does not match the PASONG song price."
        });
      }

      // --------------------------------------------------
      // CHECK DUPLICATE PAYMENT
      // --------------------------------------------------

      const existingPayment =
        await supabase
          .from("payments")
          .select(`
            id,
            order_id,
            transaction_id,
            external_reference,
            status
          `)
          .or(
            "transaction_id.eq." +
              transactionId +
              ",external_reference.eq." +
              externalReference
          )
          .limit(1)
          .maybeSingle();

      if (
        existingPayment.error
      ) {
        console.error(
          "Existing payment check error:",
          existingPayment.error
        );

        return res.status(500).json({
          error:
            "Could not verify payment history."
        });
      }

      if (
        existingPayment.data
      ) {
        return res.json({
          success:
            true,

          already_completed:
            true,

          order_id:
            existingPayment.data
              .order_id,

          payment_id:
            existingPayment.data
              .id,

          status:
            existingPayment.data
              .status,

          message:
            "This payment has already been completed."
        });
      }

      // --------------------------------------------------
      // CHECK PREVIOUS SONG OWNERSHIP
      // --------------------------------------------------

      const existingDownload =
        await supabase
          .from("downloads")
          .select(
            "id,order_id"
          )
          .eq(
            "user_id",
            buyerId
          )
          .eq(
            "song_id",
            songId
          )
          .limit(1)
          .maybeSingle();

      if (
        existingDownload.error
      ) {
        console.error(
          "Existing download check error:",
          existingDownload.error
        );

        return res.status(500).json({
          error:
            "Could not check previous purchase."
        });
      }

      if (
        existingDownload.data
      ) {
        return res.status(409).json({
          error:
            "This account already owns this song.",

          already_owned:
            true,

          order_id:
            existingDownload.data
              .order_id
        });
      }

      // --------------------------------------------------
      // CREATE ORDER
      // --------------------------------------------------

      const orderResult =
        await supabase
          .from("orders")
          .insert({
            buyer_id:
              buyerId,

            total_amount:
              paidAmount,

            currency:
              paidCurrency,

            status:
              "paid"
          })
          .select()
          .single();

      if (orderResult.error) {
        console.error(
          "Order creation error:",
          orderResult.error
        );

        return res.status(500).json({
          error:
            "Payment was verified but the PASONG order could not be created."
        });
      }

      const order =
        orderResult.data;

      // --------------------------------------------------
      // CREATE ORDER ITEM
      // --------------------------------------------------

      const orderItemResult =
        await supabase
          .from("order_items")
          .insert({
            order_id:
              order.id,

            song_id:
              songId,

            price:
              paidAmount,

            currency:
              paidCurrency
          })
          .select()
          .single();

      if (orderItemResult.error) {
        console.error(
          "Order item creation error:",
          orderItemResult.error
        );

        await supabase
          .from("orders")
          .update({
            status:
              "failed"
          })
          .eq(
            "id",
            order.id
          );

        return res.status(500).json({
          error:
            "Order could not be completed."
        });
      }

      // --------------------------------------------------
      // CREATE PAYMENT RECORD
      // --------------------------------------------------

      const paymentResult =
        await supabase
          .from("payments")
          .insert({
            order_id:
              order.id,

            user_id:
              buyerId,

            provider:
              provider,

            transaction_id:
              transactionId,

            external_reference:
              externalReference,

            amount:
              paidAmount,

            currency:
              paidCurrency,

            status:
              "successful",

            raw_response:
              body.provider_response ||
              body
          })
          .select()
          .single();

      if (paymentResult.error) {
        console.error(
          "Payment record error:",
          paymentResult.error
        );

        return res.status(500).json({
          error:
            "Payment was verified but the payment record could not be saved."
        });
      }

      const payment =
        paymentResult.data;

      // --------------------------------------------------
      // CREATE DOWNLOAD OWNERSHIP
      // --------------------------------------------------

      const downloadResult =
        await supabase
          .from("downloads")
          .insert({
            user_id:
              buyerId,

            song_id:
              songId,

            order_id:
              order.id
          })
          .select()
          .single();

      if (downloadResult.error) {
        console.error(
          "Download ownership error:",
          downloadResult.error
        );

        return res.status(500).json({
          error:
            "Payment was successful but download ownership could not be created."
        });
      }

      // --------------------------------------------------
      // GET ARTIST CREDITS
      // --------------------------------------------------

      const creditsResult =
        await supabase
          .from("song_artists")
          .select(
            "artist_user_id,artist_share_percent,artist_order"
          )
          .eq(
            "song_id",
            songId
          )
          .order(
            "artist_order",
            {
              ascending:
                true
            }
          );

      if (
        creditsResult.error
      ) {
        console.error(
          "Artist credits lookup error:",
          creditsResult.error
        );

        return res.status(500).json({
          error:
            "Payment succeeded but artist royalty information could not be loaded."
        });
      }

      const artistRows =
        creditsResult.data ||
        [];

      // --------------------------------------------------
      // CALCULATE ROYALTIES
      // --------------------------------------------------

      const royalty =
        calculateRoyaltyAmounts(
          paidAmount,
          artistRows
        );

      const ledgerRows =
        [];

      // --------------------------------------------------
      // ARTIST ROYALTIES
      // --------------------------------------------------

      for (
        let i = 0;
        i < royalty.artist.length;
        i++
      ) {
        const artist =
          royalty.artist[i];

        ledgerRows.push({
          recipient_user_id:
            artist.recipient_user_id,

          recipient_type:
            "artist",

          song_id:
            songId,

          sale_reference:
            externalReference,

          sale_amount:
            paidAmount,

          currency:
            paidCurrency,

          percentage:
            artist.percentage,

          amount:
            artist.amount,

          entry_type:
            "credit",

          status:
            "available"
        });
      }

      // --------------------------------------------------
      // PRODUCER
      // --------------------------------------------------

      if (
        song.producer_user_id
      ) {
        ledgerRows.push({
          recipient_user_id:
            song.producer_user_id,

          recipient_type:
            "producer",

          song_id:
            songId,

          sale_reference:
            externalReference,

          sale_amount:
            paidAmount,

          currency:
            paidCurrency,

          percentage:
            20,

          amount:
            royalty.producer,

          entry_type:
            "credit",

          status:
            "available"
        });
      } else {
        ledgerRows.push({
          recipient_user_id:
            process.env
              .PASONG_USER_ID ||
            null,

          recipient_type:
            "pasong",

          song_id:
            songId,

          sale_reference:
            externalReference,

          sale_amount:
            paidAmount,

          currency:
            paidCurrency,

          percentage:
            20,

          amount:
            royalty.producer,

          entry_type:
            "credit",

          status:
            "available"
        });
      }

      // --------------------------------------------------
      // WRITER
      // --------------------------------------------------

      if (
        song.writer_user_id
      ) {
        ledgerRows.push({
          recipient_user_id:
            song.writer_user_id,

          recipient_type:
            "writer",

          song_id:
            songId,

          sale_reference:
            externalReference,

          sale_amount:
            paidAmount,

          currency:
            paidCurrency,

          percentage:
            15,

          amount:
            royalty.writer,

          entry_type:
            "credit",

          status:
            "available"
        });
      } else {
        ledgerRows.push({
          recipient_user_id:
            process.env
              .PASONG_USER_ID ||
            null,

          recipient_type:
            "pasong",

          song_id:
            songId,

          sale_reference:
            externalReference,

          sale_amount:
            paidAmount,

          currency:
            paidCurrency,

          percentage:
            15,

          amount:
            royalty.writer,

          entry_type:
            "credit",

          status:
            "available"
        });
      }

      // --------------------------------------------------
      // PASONG PLATFORM SHARE
      // --------------------------------------------------

      ledgerRows.push({
        recipient_user_id:
          process.env
            .PASONG_USER_ID ||
          null,

        recipient_type:
          "pasong",

        song_id:
          songId,

        sale_reference:
          externalReference,

        sale_amount:
          paidAmount,

        currency:
          paidCurrency,

        percentage:
          25,

        amount:
          royalty.pasong,

        entry_type:
          "credit",

        status:
          "available"
      });

      // --------------------------------------------------
      // SAVE ROYALTY LEDGER
      // --------------------------------------------------

      const ledgerResult =
        await supabase
          .from("royalty_ledger")
          .insert(
            ledgerRows
          )
          .select();

      if (
        ledgerResult.error
      ) {
        console.error(
          "Royalty ledger error:",
          ledgerResult.error
        );

        return res.status(500).json({
          error:
            "Payment succeeded but royalty records could not be created."
        });
      }

      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------

      return res.json({
        success:
          true,

        already_completed:
          false,

        order_id:
          order.id,

        payment_id:
          payment.id,

        download_id:
          downloadResult.data.id,

        song_id:
          songId,

        title:
          song.title,

        amount:
          paidAmount,

        currency:
          paidCurrency,

        status:
          "completed",

        message:
          "Payment completed successfully. Song ownership and royalties have been recorded."
      });
    } catch (error) {
      console.error(
        "Payment completion error:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Payment completion failed."
      });
    }
  }
);

// ======================================================
// START SERVER
// ======================================================

app.listen(
  PORT,
  function () {
    console.log(
      "PASONG API running on port " +
      PORT
    );
  }
);
