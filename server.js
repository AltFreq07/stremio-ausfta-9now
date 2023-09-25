#!/usr/bin/env node

import sdk from "stremio-addon-sdk";
const { serveHTTP } = sdk;
import addonInterface from "./addon.js";
serveHTTP(addonInterface, { port: process.env.PORT || 64414 });

// when you've deployed your addon, un-comment this line
// publishToCentral("https://my-addon.awesome/manifest.json")
// for more information on deploying, see: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/README.md
