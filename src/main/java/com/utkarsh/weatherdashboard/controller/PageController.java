package com.utkarsh.weatherdashboard.controller;

import com.utkarsh.weatherdashboard.config.Cities;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Serves the single-page app with per-city SEO tags (title, description, canonical URL),
 * plus robots.txt and sitemap.xml.
 */
@RestController
public class PageController {
    private final String template;
    private final String baseUrl;

    public PageController(@Value("${app.base-url}") String baseUrl) throws IOException {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        try (InputStream in = new ClassPathResource("page/index.html").getInputStream()) {
            this.template = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @GetMapping(value = "/", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> home() {
        return html(render(
                "SkyCast – Live Weather, Hourly & 5-Day Forecast for Any City",
                "Check live weather, hourly and 5-day forecast, humidity, wind, UV index, sunrise and sunset "
                        + "for any city in the world. Free, fast and mobile friendly.",
                baseUrl + "/", "Lucknow", "Live weather for any city"));
    }

    @GetMapping(value = "/weather/{slug}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> city(@PathVariable String slug) {
        String city = prettyCity(slug);
        if (city.isBlank()) {
            return home();
        }
        return html(render(
                "Weather in " + city + " Today – Hourly & 5-Day Forecast | SkyCast",
                "Live weather in " + city + ": current temperature, hourly forecast, 5-day forecast, humidity, "
                        + "wind speed, UV index, sunrise and sunset. Updated every few minutes.",
                baseUrl + "/weather/" + Cities.slug(city), city, "Weather in " + city));
    }

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public String robots() {
        return "User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: " + baseUrl + "/sitemap.xml\n";
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public String sitemap() {
        String today = LocalDate.now().toString();
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
                .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        xml.append(entry(baseUrl + "/", today, "daily", "1.0"));
        for (String city : Cities.POPULAR) {
            xml.append(entry(baseUrl + "/weather/" + Cities.slug(city), today, "hourly", "0.8"));
        }
        return xml.append("</urlset>\n").toString();
    }

    private static String entry(String loc, String lastmod, String freq, String priority) {
        return "  <url><loc>" + loc + "</loc><lastmod>" + lastmod + "</lastmod><changefreq>" + freq
                + "</changefreq><priority>" + priority + "</priority></url>\n";
    }

    /** "new-york" -> "New York". Only letters/spaces are kept, so output is safe for HTML. */
    private static String prettyCity(String slug) {
        String cleaned = slug.replaceAll("[^\\p{L}\\p{N}\\- ]", "").replace('-', ' ').trim();
        if (cleaned.length() > 60) {
            cleaned = cleaned.substring(0, 60);
        }
        return Arrays.stream(cleaned.split("\\s+"))
                .filter(w -> !w.isEmpty())
                .map(w -> w.substring(0, 1).toUpperCase(Locale.ROOT) + w.substring(1).toLowerCase(Locale.ROOT))
                .collect(Collectors.joining(" "));
    }

    private String render(String title, String description, String canonical, String city, String h1) {
        return template
                .replace("{{TITLE}}", HtmlUtils.htmlEscape(title))
                .replace("{{DESCRIPTION}}", HtmlUtils.htmlEscape(description))
                .replace("{{CANONICAL}}", HtmlUtils.htmlEscape(canonical))
                .replace("{{BASE_URL}}", HtmlUtils.htmlEscape(baseUrl))
                .replace("{{CITY}}", HtmlUtils.htmlEscape(city))
                .replace("{{H1}}", HtmlUtils.htmlEscape(h1));
    }

    private ResponseEntity<String> html(String body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .contentType(MediaType.TEXT_HTML)
                .body(body);
    }
}
