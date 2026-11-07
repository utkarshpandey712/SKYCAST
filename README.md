# SkyCast – Weather Website (Spring Boot + HTML/CSS/JS)

Features: live weather + city search (with suggestions), current temp & conditions, 24-hour hourly forecast,
5-day forecast, humidity / wind / UV index / pressure, sunrise & sunset arc, favourite cities,
dark/light mode, °C/°F, animated weather backgrounds, "my location", mobile friendly, SEO ready.

## Run locally
    mvn spring-boot:run
Open http://localhost:8080  (needs JDK 17+, Maven, internet)

## Deploy (Render.com, free)
1. Push this folder to GitHub.
2. Render -> New -> Web Service -> select repo -> Runtime: Docker.
3. Environment variable: APP_BASE_URL = https://your-domain.com
4. Add your custom domain in Render, then follow DEPLOY-AND-SEO.md.

## SEO included
Per-city pages (/weather/lucknow), title/description/canonical/Open Graph tags, JSON-LD, robots.txt,
sitemap.xml (auto-generated), favicon, web manifest, crawlable popular-city links, FAQ.

Weather data: Open-Meteo (keep the attribution link in the footer).
