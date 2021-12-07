import config from './config';
import fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import Moniker from 'moniker';
import os from 'os';
import cors from 'cors';
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import { searchYoutube } from './utils/youtube';
import { Room } from './room';
import { validateUserToken } from './utils/firebase';
import path from 'path';
import { hashString } from './utils/string';

const releaseInterval = 5 * 60 * 1000;
const releaseBatches = 5;
const app = express();
let server: any = null;
if (config.HTTPS) {
  const key = fs.readFileSync(config.SSL_KEY_FILE as string);
  const cert = fs.readFileSync(config.SSL_CRT_FILE as string);
  server = https.createServer({ key: key, cert: cert }, app);
} else {
  server = new http.Server(app);
}
const io = new Server(server, { cors: {}, transports: ['websocket'] });

const names = Moniker.generator([
  Moniker.adjective,
  Moniker.noun,
  Moniker.verb,
]);
const launchTime = Number(new Date());
const rooms = new Map<string, Room>();
init();

async function init() {
  if (!rooms.has('/default')) {
    rooms.set('/default', new Room(io, '/default'));
  }

  server.listen(config.PORT, config.HOST);
  // Following functions iterate over in-memory rooms
  setInterval(release, releaseInterval / releaseBatches);
  saveRooms();
  if (process.env.NODE_ENV === 'development') {
    require('./vmWorker');
    require('./syncSubs');
    require('./timeSeries');
  }
}

app.use(cors());
app.use(bodyParser.json());

app.get('/ping', (_req, res) => {
  res.json('pong');
});

app.use(compression());

app.get('/stats', async (req, res) => {
  if (req.query.key && req.query.key === config.STATS_KEY) {
    const stats = await getStats();
    res.json(stats);
  } else {
    return res.status(403).json({ error: 'Access Denied' });
  }
});

app.get('/youtube', async (req, res) => {
  if (typeof req.query.q === 'string') {
    try {
      const items = await searchYoutube(req.query.q);
      res.json(items);
    } catch {
      return res.status(500).json({ error: 'youtube error' });
    }
  } else {
    return res.status(500).json({ error: 'query must be a string' });
  }
});

app.post('/createRoom', async (req, res) => {
  const genName = () =>
    '/' + (config.SHARD ? `${config.SHARD}@` : '') + names.choose();
  let name = genName();
  // Keep retrying until no collision
  while (rooms.has(name)) {
    name = genName();
  }
  console.log('createRoom: ', name);
  const newRoom = new Room(io, name);
  const decoded = await validateUserToken(req.body?.uid, req.body?.token);
  newRoom.creator = decoded?.email;
  newRoom.video = req.body?.video || '';
  rooms.set(name, newRoom);
  res.json({ name: name.slice(1) });
});

app.get('/settings', (req, res) => {
  if (req.hostname === config.CUSTOM_SETTINGS_HOSTNAME) {
    return res.json({
      mediaPath: config.MEDIA_PATH,
      streamPath: config.STREAM_PATH,
    });
  }
  return res.json({});
});

app.post('/manageSub', async (req, res) => {
  const decoded = await validateUserToken(req.body?.uid, req.body?.token);
  if (!decoded) {
    return res.status(400).json({ error: 'invalid user token' });
  }
  if (!decoded.email) {
    return res.status(400).json({ error: 'no email found' });
  }
});

app.get('/metadata', async (req, res) => {
  let isCustomer = false;
  let isSubscriber = false;
  return res.json({ isSubscriber, isCustomer });
});

app.delete('/deleteRoom', async (req, res) => {
  const decoded = await validateUserToken(
    req.query?.uid as string,
    req.query?.token as string
  );
  if (!decoded) {
    return res.status(400).json({ error: 'invalid user token' });
  }
});

app.use(express.static(config.BUILD_DIRECTORY));
// Send index.html for all other requests (SPA)
app.use('/*', (_req, res) => {
  res.sendFile(
    path.resolve(__dirname + `/../${config.BUILD_DIRECTORY}/index.html`)
  );
});

async function saveRooms() {
  while (true) {
    // console.time('[SAVEROOMS]');
    const roomArr = Array.from(rooms.values());
    for (let i = 0; i < roomArr.length; i++) {
      if (roomArr[i].roster.length) {
        await roomArr[i].saveRoom();
      }
    }
    // console.timeEnd('[SAVEROOMS]');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

let currBatch = 0;
async function release() {
  // Reset VMs in rooms that are:
  // older than the session limit
  // assigned to a room with no users
  const roomArr = Array.from(rooms.values()).filter((room) => {
    return hashString(room.roomId) % releaseBatches === currBatch;
  });
  console.log('[RELEASE][%s] %s rooms in batch', currBatch, roomArr.length);
  currBatch = (currBatch + 1) % releaseBatches;
}

async function getStats() {
  const now = Number(new Date());
  const currentRoomData: any[] = [];
  let currentUsers = 0;
  let currentHttp = 0;
  let currentVBrowser = 0;
  let currentVBrowserLarge = 0;
  let currentVBrowserWaiting = 0;
  let currentScreenShare = 0;
  let currentFileShare = 0;
  let currentVideoChat = 0;
  let currentRoomSizeCounts: NumberDict = {};
  let currentVBrowserUIDCounts: NumberDict = {};
  let currentRoomCount = rooms.size;
  rooms.forEach((room) => {
    const obj = {
      creationTime: room.creationTime,
      lastUpdateTime: room.lastUpdateTime,
      roomId: room.roomId,
      video: room.video,
      videoTS: room.videoTS,
      rosterLength: room.roster.length,
      roster: room.getRosterForStats(),
      videoChats: room.roster.filter((p) => p.isVideoChat).length,
      vBrowser: room.vBrowser,
      vBrowserElapsed:
        room.vBrowser?.assignTime && now - room.vBrowser?.assignTime,
      lock: room.lock || undefined,
      creator: room.creator || undefined,
    };
    currentUsers += obj.rosterLength;
    currentVideoChat += obj.videoChats;
    if (obj.vBrowser) {
      currentVBrowser += 1;
    }
    if (obj.vBrowser && obj.vBrowser.large) {
      currentVBrowserLarge += 1;
    }
    if (obj.video?.startsWith('http') && obj.rosterLength) {
      currentHttp += 1;
    }
    if (obj.video?.startsWith('screenshare://') && obj.rosterLength) {
      currentScreenShare += 1;
    }
    if (obj.video?.startsWith('fileshare://') && obj.rosterLength) {
      currentFileShare += 1;
    }
    if (obj.rosterLength > 0) {
      if (!currentRoomSizeCounts[obj.rosterLength]) {
        currentRoomSizeCounts[obj.rosterLength] = 0;
      }
      currentRoomSizeCounts[obj.rosterLength] += 1;
    }
    if (obj.vBrowser && obj.vBrowser.creatorUID) {
      if (!currentVBrowserUIDCounts[obj.vBrowser.creatorUID]) {
        currentVBrowserUIDCounts[obj.vBrowser.creatorUID] = 0;
      }
      currentVBrowserUIDCounts[obj.vBrowser.creatorUID] += 1;
    }
    if (obj.video || obj.rosterLength > 0) {
      currentRoomData.push(obj);
    }
  });

  currentVBrowserUIDCounts = Object.fromEntries(
    Object.entries(currentVBrowserUIDCounts).filter(([, val]) => val > 1)
  );

  // Sort newest first
  currentRoomData.sort((a, b) => b.creationTime - a.creationTime);
  const uptime = Number(new Date()) - launchTime;
  const cpuUsage = os.loadavg();
  const memUsage = process.memoryUsage().rss;

  return {
    uptime,
    cpuUsage,
    memUsage,
    currentRoomCount,
    currentRoomSizeCounts,
    currentUsers,
    currentVBrowser,
    currentVBrowserLarge,
    currentVBrowserWaiting,
    currentHttp,
    currentScreenShare,
    currentFileShare,
    currentVideoChat,
    currentVBrowserUIDCounts,
    currentRoomData,
  };
}
