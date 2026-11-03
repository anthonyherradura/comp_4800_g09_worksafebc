# Auth / backend setup guide

How to get the HIIPS360 API and database running on your own machine, so sign-in works when you run the app.

Everything runs **locally**. You don't need a MongoDB Atlas account or any online service. Each of us has our own database on our own laptop, so accounts you create aren't shared with the rest of the group.

## What's in the repo

| Piece | Where | What it does |
|---|---|---|
| API | `server/` | Express app on port 3001: register, sign in, sign out, "who am I" |
| Database | MongoDB on your machine | Stores users (passwords as bcrypt hashes only) and sign-in sessions |
| Front end | `src/` | Vite on port 5173. It forwards `/api` requests to the API, so you only ever open 5173 |
| Settings | `.env` (you create it) | Database address and the session secret. **Never commit it.** |

## 1. Install the prerequisites (once)

1. **Node.js 22.12 or newer.** Check with `node --version`.
2. **MongoDB Community Server 8.0.** Download the Windows `.msi` from https://www.mongodb.com/try/download/community. During the install:
   - Choose **Complete**.
   - Leave **Install MongoD as a Service** ticked. This makes MongoDB start by itself whenever Windows starts.
   - Installing **MongoDB Compass** (a GUI for browsing the database) is optional but handy.
3. **mongosh** (optional). It's the MongoDB command-line shell, useful for checking the database: https://www.mongodb.com/try/download/shell

## 2. Make sure MongoDB is running

Open PowerShell and run:

```powershell
Get-Service MongoDB
```

`Status` should be `Running`. If it says `Stopped`, you need an **administrator** PowerShell to start it. A normal window and the VS Code terminal both fail with "Access is denied". Right-click Start, choose **Terminal (Admin)**, then run:

```powershell
Set-Service MongoDB -StartupType Automatic; Start-Service MongoDB
```

You only need to do this once. After that it starts by itself whenever Windows starts.

<details>
<summary>No admin rights on your machine? Run MongoDB without the service</summary>

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\mongo-data" | Out-Null
& "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "$env:USERPROFILE\mongo-data" --bind_ip 127.0.0.1
```

Leave that window open while you work, because closing it stops the database. Your `.env` doesn't need changing.
</details>

## 3. Create your `.env` file

From the project folder:

```powershell
npm install
cp .env.example .env
```

Next, generate a session secret and put it into `.env`:

```powershell
$s = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
(Get-Content .env) -replace '^SESSION_SECRET=.*$', "SESSION_SECRET=$s" | Set-Content .env
```

Your `.env` should end up looking like this, with your own random secret:

```
MONGODB_URI=mongodb://127.0.0.1:27017/hiips360
SESSION_SECRET=3f9c...64 hex characters...
PORT=3001
```

Notes:
- **Keep `127.0.0.1`. Don't change it to `localhost`.** Node tries IPv6 first, and MongoDB on Windows only listens on IPv4, so `localhost` fails to connect.
- **Everyone uses a different secret.** Don't share yours or paste it in chat.
- `.env` is in `.gitignore`. If `git status` ever lists it, stop and ask before committing.
- `.env` starts with a dot, so VS Code may not show it in the file explorer. Open it with **Ctrl+P**, type `.env`, then press Enter.
- If VS Code shows the popup "An environment file is configured but terminal environment injection is disabled", ignore it. The API reads `.env` itself.

## 4. Run it

```powershell
npm run dev:all
```

You should see both:

```
[api] HIIPS360 API on http://localhost:3001 (MongoDB connected)
[web]   ➜  Local:   http://localhost:5173/
```

Open http://localhost:5173, choose **Create an account**, and you should land on the home page.

Other scripts if you need them:

| Command | Runs |
|---|---|
| `npm run dev:all` | API + front end together (normal use) |
| `npm run dev` | Front end only |
| `npm run dev:api` | API only, restarts when you edit `server/` |
| `npm run build` then `npm run preview` | Production build, needed to test the offline/PWA behaviour |

## 5. Check it worked (optional)

```powershell
mongosh hiips360 --eval "db.users.find({}, { name: 1, email: 1 }).toArray()"
```

You should see the account you just made. Each document also has a `passwordHash` starting with `$2b$`; the real password is never stored.

## 6. Set up the inspection database (once)

The inspection data (job sites, inspections, hazards, photos, Summary reviews) uses MongoDB **transactions**, so a whole save either happens or doesn't. Transactions need MongoDB running as a **replica set**. A single-node one on your laptop is enough. Sign-in works without this, but `npm run db:setup` stops with a "standalone server" message until it's done.

1. Open **Command Prompt as administrator** (right-click, **Run as administrator**) and open the config file:
   ```cmd
   notepad "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg"
   ```
   Find `#replication:` near the bottom and replace it with these two lines. Use **two spaces** before `replSetName`, not a tab:
   ```yaml
   replication:
     replSetName: rs0
   ```
2. Save, then restart MongoDB in the same admin window:
   ```cmd
   net stop MongoDB
   net start MongoDB
   ```
3. Start the replica set. This works in a normal window:
   ```cmd
   npx mongosh --quiet --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"
   ```
   Use this exact command, not plain `rs.initiate()`, which can register your computer's name instead of `127.0.0.1` and stop the API connecting.
4. Check it. This should print `rs0`:
   ```cmd
   npx mongosh --quiet --eval "db.hello().setName"
   ```
5. In `.env`, remove the `#` in front of `MONGODB_TEST_URI` so the line reads:
   ```
   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
   ```
   Keep `MONGODB_URI` as it is.
6. From the project folder, create the collections and load the protocol sheets:
   ```cmd
   npm run db:setup
   ```
   It should end with `sheets: 2, sections: 21, chunks: 104 …` and `MongoDB is ready.`
7. Check everything passes:
   ```cmd
   npm test
   npm run test:db
   ```
   `npm run test:db` uses its own throwaway `hiips360_test_…` database and deletes it afterwards, so your data isn't touched.

**After pulling new changes**, run `npm install` and then `npm run db:setup` again. It updates the database rules and loads any new sheets without touching your data.

**Your data stays on your laptop.** Like accounts, the inspections you record are in your own local database, and nobody else in the group sees them.

## Troubleshooting

| You see | Fix |
|---|---|
| `Missing SESSION_SECRET` (or `MONGODB_URI`) when the API starts | `.env` is missing or that line is empty. Redo step 3. |
| `Could not connect to MongoDB ... Is the MongoDB service running?` | Run `Get-Service MongoDB`. If it's stopped, see step 2. |
| `Access is denied` when starting the service | You're not in an administrator PowerShell. See step 2. |
| `[vite] http proxy error ... ECONNREFUSED`, or "Can't reach the HIIPS360 server" on sign-in | The API isn't running. Use `npm run dev:all`, not `npm run dev`. If you only see this in the first second after starting, the API was still connecting and you can ignore it. |
| `EADDRINUSE :3001` or `:5173` | An old dev server is still running. Close the other terminal. If there isn't one, find the process with `Get-NetTCPConnection -LocalPort 3001 -State Listen` and stop it with `Stop-Process -Id <OwningProcess>`. Or change `PORT` in `.env`. |
| `npm run db:setup` says "standalone server" | MongoDB isn't a replica set yet. Do step 6. |
| `net start MongoDB` fails after editing `mongod.cfg` | Almost always the indentation: two spaces before `replSetName`, no tabs. The exact error is at the end of `C:\Program Files\MongoDB\Server\8.0\log\mongod.log`. |
| `rs.initiate` says `already initialized` | It's already set up. Carry on from step 6.4. |
| You're still signed in after the API was stopped | This is intentional. The app remembers the last signed-in user on the device so officers stay signed in with no signal. |

## Resetting your local data

To delete every account and session in **your own** local database:

```powershell
mongosh hiips360 --eval "db.users.deleteMany({}); db.sessions.deleteMany({})"
```

To delete **all** your local data, inspections included, and start fresh:

```powershell
npx mongosh hiips360 --quiet --eval "db.dropDatabase()"
npm run db:setup
```
