import { addonBuilder } from "stremio-addon-sdk";

const channels = [];
const tvSeries = [];
const api_url = "https://api.9now.com.au/livestreams";
const series_url = "https://tv-api.9now.com.au/v2/pages/tv-series?device=web";
const series_api = (series_slug) =>
  `https://tv-api.9now.com.au/v2/pages/tv-series/${series_slug}?device=web`;
const episodes_api = (series_slug, seasons_slug) =>
  `https://tv-api.9now.com.au/v2/pages/tv-series/${series_slug}/seasons/${seasons_slug}/episodes?device=web`;

// headers={'BCOV-POLICY': BRIGHTCOVE_KEY}
const brightcove_key =
  "BCpkADawqM1TWX5yhWjKdzhXnHCmGvnaozGSDICiEFNRv0fs12m6WA2hLxMHM8TGAEM6pv7lhJsdNhiQi76p4IcsT_jmXdtEU-wnfXhOBTx-cGR7guCqVwjyFAtQa75PFF-TmWESuiYaNTzg";

const brightcove_account = "4460760524001";
const brightcove_headers = { "BCOV-POLICY": brightcove_key };
const brightcove_api = (referenceID) =>
  `https://edge.api.brightcove.com/playback/v1/accounts/${brightcove_account}/videos/ref%3A${referenceID}`;

await fetchAPI();

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
  id: "community.AusFTA",
  version: "0.0.50",
  catalogs: [
    {
      type: "tv",
      id: "9Now",
      name: "9Now Live Channels",
      extra: [
        { name: "skip", isRequired: false },
        { name: "search", isRequired: false },
      ],
    },
    {
      type: "series",
      id: "9Now",
      name: "9Now TV Series",
      extra: [
        { name: "skip", isRequired: false },
        { name: "search", isRequired: false },
      ],
      genres: [
        ...new Set(
          tvSeries.flatMap((series) => [
            series.genre.name,
            ...series.secondaryGenres.map((genre) => genre.name),
          ])
        ),
      ],
    },
  ],
  resources: [
    "catalog",
    {
      name: "meta",
      types: ["series", "tv"],
    },
    "stream",
  ],
  types: ["series", "tv"],
  name: "Aus-FTA",
  description:
    "Provides sources for Australian free to air live tv and videos on demand",
};

const builder = new addonBuilder(manifest);
function get9NowLiveCatalog() {
  return channels.map((channel) => {
    const listings = channel.listings;
    return {
      id: channel.slug,
      type: "tv",
      name: channel.name,
      logo: channel.logo.webpSizes.w1920,
      poster: channel.cardImage.webpSizes.w1920,
      background: channel.image.webpSizes.w1920,
      posterShape: "landscape",
      genres: [listings[0].genre, "Live"],
      description: `Currently Playing - ${listings[0].name} ${
        listings[0].name !== listings[0].episodeTitle
          ? "-" + listings[0].episodeTitle
          : ""
      }\n
        Up Next - ${listings[1].name} ${
        listings[1].name !== listings[1].episodeTitle
          ? "-" + listings[1].episodeTitle
          : ""
      }\n
        Later - ${listings[2].name} ${
        listings[2].name !== listings[2].episodeTitle
          ? "-" + listings[2].episodeTitle
          : ""
      }\n`,
      runtime: "Live",
    };
  });
}

function get9NowTvSeriesCatalog() {
  return tvSeries.map((series) => {
    return {
      id: series.slug,
      type: "series",
      name: series.name,
      poster: series.image.webpSizes.w1920,
      posterShape: "landscape",
      description: series.description,
      genres: [
        series.genre.name,
        ...series.secondaryGenres.map((genre) => genre.name),
      ],
    };
  });
}

async function get9NowTvSeriesStreams(id) {
  console.log("Getting 9Now tvseries streams for: " + id);
  //series:season:episode
  const [series, season, episode] = id.split(":");
  const seriesData = tvSeries.find((s) => s.slug === series);
  const seasonData = seriesData.seasons.find((s) => s.slug === season);
  const episodeData = seasonData.episodes.find((e) => e.slug === episode);
  //use brightcove headers
  const res = await fetch(brightcove_api(episodeData.video.referenceId), {
    headers: brightcove_headers,
  });
  const data = await res.json();
  return data.sources
    .filter((source) => {
      return (
        source.src.startsWith("https://") &&
        source.type !== "application/vnd.ms-sstr+xml" &&
        source.key_systems &&
        source.key_systems["com.widevine.alpha"]
      );
    })
    .map((source) => {
      return {
        title:
          source.codecs + " " + source.type + " " + (source.profiles || ""),
        url: source.src,
      };
    });
}

function get9NowLiveStreams(id) {
  console.log("Getting 9Now live streams for: " + id);
  return channels
    .filter((channel) => channel.slug === id)
    .map((channel) => {
      return {
        title: channel.name,
        url: channel.stream.url,
      };
    });
}

function get9NowLiveMeta(id) {
  console.log("Getting 9Now live meta for: " + id);
  return channels
    .filter((channel) => channel.slug === id)
    .map((channel) => {
      const listings = channel.listings;
      return {
        id: channel.slug,
        type: "tv",
        name: channel.name,
        logo: channel.logo.webpSizes.w1920,
        poster: channel.cardImage.webpSizes.w1920,
        background: channel.image.webpSizes.w1920,
        posterShape: "landscape",
        genres: [listings[0].genre, "Live", "TV"],
        description: `Currently Playing - ${listings[0].name} ${
          listings[0].name !== listings[0].episodeTitle
            ? "-" + listings[0].episodeTitle
            : ""
        }\n
          Up Next - ${listings[1].name} ${
          listings[1].name !== listings[1].episodeTitle
            ? "-" + listings[1].episodeTitle
            : ""
        }\n
          Later - ${listings[2].name} ${
          listings[2].name !== listings[2].episodeTitle
            ? "-" + listings[2].episodeTitle
            : ""
        }\n`,
        runtime: "Live",
      };
    })[0];
}

async function get9NowTvSeriesEpisodes(slug) {
  const series = tvSeries.find((s) => s.slug === slug);
  const seasons = series.seasons;
  const promises = seasons.map(async (season) => {
    const res = await fetch(episodes_api(slug, season.slug));
    return res.json();
  });
  const videos = [];
  const allData = await Promise.all(promises);
  allData.forEach((data) => {
    series.seasons.find((s) => s.slug === data.season.slug).episodes =
      data.episodes.items;
    data.episodes.items.forEach((episode) => {
      videos.push({
        season: data.season.seasonNumber,
        episode: episode.episodeNumber,
        id: `${series.slug}:${data.season.slug}:${episode.slug}`,
        title: episode.name,
        thumbnail: episode.image.webpSizes.w1920,
        released: episode.airDate,
        overview: episode.description,
      });
    });
  });
  // console.log("Returning data");
  return videos;
}

async function getSeriesData(id) {
  //fetch series data then add resp.tvSeries to matching tvSeries
  const res = await fetch(series_api(id));
  const data = await res.json();
  const index = tvSeries.findIndex((series) => series.slug === id);
  const series = tvSeries.find((series) => series.slug === id);
  Object.assign(series, data.tvSeries, {
    logo:
      data.season.croppedLogo?.webpSizes?.w1920 ??
      data.season.croppedLogo?.sizes?.w1920,
    backgroundImage: data.season.backgroundImage.webpSizes.w1920,
    seasons: data.seasons,
  });
}

async function get9NowTvSeriesMeta(id) {
  console.log("Getting 9Now tv series meta for: " + id);
  let series = tvSeries.find((s) => s.slug === id);
  if (!series) return null;
  let country;

  if (series.countryOfOrigin) {
    country = series.countryOfOrigin;
  } else {
    await getSeriesData(series.slug);
    country = series.countryOfOrigin;
  }
  return {
    id: series.slug,
    type: "series",
    name: series.name,
    poster: series.image.webpSizes.w1920,
    posterShape: "landscape",
    description: series.description,
    background: series.backgroundImage || series.image.webpSizes.w1920,
    genres: [series.genre.name],
    country: country,
    logo: series.logo,
    videos: await get9NowTvSeriesEpisodes(series.slug),
  };
}

builder.defineCatalogHandler(({ type, id, extra }) => {
  let results = [];
  console.log("request for catalogs: " + type + " " + id);

  switch (type) {
    case "tv":
      results = Promise.resolve(get9NowLiveCatalog());
      break;
    case "series":
      results = Promise.resolve(get9NowTvSeriesCatalog());
      break;
    default:
      results = Promise.resolve([]);
  }

  if (extra.search) {
    console.log("Searching for: " + extra.search);
    return results.then((items) => ({
      metas: items.filter(
        (meta) =>
          meta.name.toLowerCase().includes(extra.search.toLowerCase()) ||
          meta.id.toLowerCase().includes(extra.search.toLowerCase())
      ),
    }));
  } else if (extra.genre) {
    return results.then((items) => ({
      metas: items.filter((meta) =>
        meta.genres ? meta.genres.includes(extra.genre) : false
      ),
    }));
  }

  const skip = extra.skip || 0;
  return results.then((items) => ({
    metas: items.slice(skip, skip + 100),
  }));
});

builder.defineMetaHandler(async ({ type, id }) => {
  console.log("request for meta: " + type + " " + id);
  let results;

  switch (type) {
    case "tv":
      results = get9NowLiveMeta(id);
      // console.log(results);
      break;
    case "series":
      results = await get9NowTvSeriesMeta(id);
      // console.log(results);
      break;
    default:
      results = null;
      break;
  }
  return Promise.resolve({
    meta: results,
    cacheMaxAge: 5,
    staleRevalidate: 5,
    staleError: 20,
  });
});

builder.defineStreamHandler(async ({ type, id }) => {
  let results;
  console.log("request for streams: " + type + " " + id);
  switch (type) {
    case "series":
      results = await get9NowTvSeriesStreams(id);
      break;
    case "tv":
      results = get9NowLiveStreams(id);
      break;
    default:
      results = [];
      break;
  }
  return Promise.resolve({
    streams: results,
    cacheMaxAge: 5,
    staleRevalidate: 5,
    staleError: 20,
  });
});

async function fetchAPI() {
  const res = await fetch(api_url);
  const data = await res.json();
  data.data.getLivestream.channels.forEach((channel) => {
    channels.push(channel);
  });

  const res2 = await fetch(series_url);
  const data2 = await res2.json();
  data2.tvSeries.forEach((series) => {
    series.slug = series.slug;
    tvSeries.push(series);
  });
  console.log("Addon started successfully");
}

export default builder.getInterface();
