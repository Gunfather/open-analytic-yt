# Open Analytic YT

Open-source multi-channel, multi-language YouTube analytics dashboard inspired by stock/crypto tickers and YouTube Studio.

All user data (channels, groups, API keys, SMTP credentials, and scheduled tasks) is stored **locally in your browser (`localStorage`)** — nothing is hardcoded or sent to external servers except the official YouTube endpoints / your configured SMTP server.

## Features

- **Multi-Channel & Multi-Language Monitoring**: Filter across channels, custom languages, groups, and periods (`24h`, `48h`, `7d`, `14d`, `30d`, `90d`).
- **Keyless Public Sync + Optional YouTube Data API v3**: Sync public channel stats and recent videos without needing a Google Cloud API key, or optionally add your own YouTube Data API v3 key.
- **YouTube Studio CSV Import**: Import exported Analytics CSVs for exact Watch Time and Revenue.
- **Advanced Mode (Scatter Plot)**: Compare video performance (`Best`, `Average`, `Worst`) across time since publish.
- **Audience & Discovery Cards**: Traffic sources, demographics, viewing behavior, device types, geographies, age, and gender (with hide/show toggles).
- **AI-Ready PDF Export**: Customize filters and sections to download a clean vector PDF report.
- **Scheduled Email Reports**: Schedule daily, weekly, monthly, or one-time PDF email reports via SMTP (`nodemailer`).
- **4-Language UI**: English (default), Portuguese (BR), French, and Spanish.

## Quick Start

```bash
npm install
npm run dev
```

On Windows, you can also double-click `iniciar-pulseyt.bat`.

## License

Dedicated to the public domain under **CC0 1.0 Universal**. See [LICENSE](./LICENSE).
