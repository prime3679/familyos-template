# FamilyOS

**Self-hosted family coordination agent. No SaaS. No subscription. Runs on your machine.**

---

I built this because two working parents, a toddler, and a second kid on the way generate more coordination overhead than any spreadsheet can handle. Who does school pickup Monday when I have a dentist appointment? Who's cooking Thursday when my partner has a late meeting? These questions are small individually. Compounded over 52 weeks, they're exhausting.

FamilyOS handles the weekly scheduling loop automatically. Every Monday morning it scans the week, figures out who should handle what based on both partners' calendars and standing constraints, sends a proposal via Telegram, waits for approval, and reminds you day-of. It learns from what you approve and reject.

This is v0.1. It's rough around the edges. It works.

---

## What it does

1. **Monday scan** — Identifies coordination needs for the week: school pickup/dropoff, date night opportunities, errands
2. **Smart assignment** — Proposes who handles what based on both partners' schedules, workout days, work constraints, and historical approval patterns
3. **Telegram proposal** — Sends a formatted weekly plan to your phone
4. **Email CC** — Copies your partner so they're in the loop
5. **Approval loop** — Reply APPROVE or tell it what to change
6. **Day-of reminders** — Morning nudges for tasks due that day
7. **Preference learning** — Over time, it gets better at predicting what you'll approve

---

## Stack

- **Node.js 22+** (uses built-in SQLite — no external DB needed)
- **TypeScript** (runs directly with `node --experimental-sqlite`, no compile step)
- **SQLite** via Node's `node:sqlite` (built-in, zero config)
- **Claude API** (Anthropic) — for future AI-assisted scheduling decisions
- **Telegram Bot API** — for proposals and reminders
- **AgentMail** — for sending email to your partner
- **Google Calendar** (optional) — via `gog` CLI for conflict detection

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/prime3679/familyos-template.git
cd familyos-template
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

- **`TELEGRAM_BOT_TOKEN`** — Create a bot with [@BotFather](https://t.me/BotFather), copy the token
- **`TELEGRAM_CHAT_ID`** — Message [@userinfobot](https://t.me/userinfobot) to get your chat ID
- **`PARTNER_EMAIL`** — Your partner's email address
- **`AGENTMAIL_API_KEY`** — Sign up at [agentmail.to](https://agentmail.to) for an outbound email inbox
- **`AGENTMAIL_FROM_EMAIL`** — Your AgentMail inbox address (e.g. `familyos@yourdomain.agentmail.to`)

Optional:
- **`PRIMARY_GOOGLE_ACCOUNT`** / **`PARTNER_GOOGLE_ACCOUNT`** — For calendar conflict detection (requires [`gog`](https://github.com/yourusername/gog) CLI)
- **`SUPERMEMORY_API_KEY`** — For context-aware memory ([supermemory.ai](https://supermemory.ai))

### 3. Configure your schedule

```bash
cp config/preferences.example.yaml config/preferences.yaml
```

Edit `config/preferences.yaml`. Key fields:

- `family.person1.name` / `family.person2.name` — Your names (used in messages)
- `childcare.child_name` — Child's name (used in task labels)
- `childcare.dropoff_days` — Which days you have school/daycare
- `fitness.workouts` — Your workout schedule (used to optimize morning dropoff routing)
- `work.heavy_days` — Days FamilyOS should avoid proposing extra tasks

### 4. Run your first scan

```bash
node --experimental-sqlite --env-file=.env src/agent.ts --scan
```

This will:
- Identify tasks for the week
- Save them to `familyos.db`
- Send a proposal to your Telegram
- Email your partner

If Telegram sends successfully, you'll see the proposal on your phone.

---

## Commands

```bash
# Weekly scan — identify tasks and send proposal
node --experimental-sqlite --env-file=.env src/agent.ts --scan

# Day-of reminders for approved tasks
node --experimental-sqlite --env-file=.env src/agent.ts --remind

# Print this week's task status
node --experimental-sqlite --env-file=.env src/agent.ts --status

# Approve the current proposal
node --experimental-sqlite --env-file=.env src/approve.ts --approve

# Reject and replan with instructions
node --experimental-sqlite --env-file=.env src/approve.ts --reject "swap Thursday pickup to Jordan"

# Swap a specific task
node --experimental-sqlite --env-file=.env src/approve.ts --swap "thursday pickup" person2

# Health check
node --experimental-sqlite --env-file=.env src/health.ts
```

Or use npm scripts:

```bash
npm run scan
npm run remind
npm run status
npm run approve
npm run health
```

---

## Automation (optional)

Set up cron jobs so it runs automatically. Edit your crontab:

```bash
crontab -e
```

Add:

```cron
# Weekly scan — Monday at 7:00 AM
0 7 * * 1 cd /path/to/familyos && node --experimental-sqlite --env-file=.env src/agent.ts --scan >> logs/scan.log 2>&1

# Daily reminders — 8:00 AM every weekday
0 8 * * 1-5 cd /path/to/familyos && node --experimental-sqlite --env-file=.env src/agent.ts --remind >> logs/remind.log 2>&1

# Health check — every Monday at 9:00 AM
0 9 * * 1 cd /path/to/familyos && node --experimental-sqlite --env-file=.env src/health.ts >> logs/health.log 2>&1
```

Create the logs directory:
```bash
mkdir -p logs
```

---

## How assignment works

FamilyOS uses a layered decision system:

1. **Hard blocks** — Work heavy days, explicit constraints in preferences → skip or reassign
2. **Workout routing** — If you work out Monday/Friday mornings, you're already up → handle dropoff
3. **Calendar conflicts** — If partner has events that day, primary user handles it
4. **Load balancing** — Track total tasks assigned each week, keep it even
5. **Historical learning** — After 3+ decisions per pattern, learned preferences override defaults

Confidence scores are tracked and proposals improve over time.

---

## Calendar integration

FamilyOS optionally reads Google Calendar to detect conflicts. This requires the `gog` CLI tool configured with your Google accounts.

Without calendar integration, it still works — it just won't know about partner's dentist appointments or your 3pm calls. You'll catch those in the approval step.

---

## Data & Privacy

Everything runs locally:
- SQLite database: `familyos.db` (in project root, gitignored)
- Preferences: `config/preferences.yaml` (gitignored)
- Logs: `logs/` directory (gitignored)

The only external calls are:
- Telegram API (to send messages)
- AgentMail API (to send partner email)
- Google Calendar (optional, read-only)
- Supermemory (optional, for context)
- Anthropic Claude API (optional, for future AI features)

No telemetry. No tracking. Your family's schedule stays on your machine.

---

## Roadmap

**v0.1 (current)** — Weekly scan, proposal, approval, reminders, load balancing

**v0.2** — Preference learning from approval history, smarter conflict detection, recurring task memory

**v0.3** — Partner agent: partner gets their own Telegram interface to suggest changes directly, not just email

**v0.4** — Natural language approval ("swap Thursday pickup and give me Friday errand")

**v1.0** — Stable API, plugin system for custom task types, proper documentation

---

## Contributing

This is a personal project that I'm open-sourcing because others asked. Pull requests welcome for:
- Bug fixes
- New task types
- Better assignment algorithms
- Calendar provider integrations (Apple Calendar, Outlook)

Keep the core simple. It should still be a single `node` command.

---

## License

MIT
