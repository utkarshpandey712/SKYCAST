package com.utkarsh.weatherdashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class WeatherService {
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private static final int CACHE_MAX = 500;

    private record CacheEntry(Instant createdAt, JsonNode forecast) {}

    private final RestClient restClient;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public WeatherService(RestClient.Builder builder) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(8000);
        this.restClient = builder.requestFactory(factory).build();
    }

    /** City suggestions for the search box. */
    public List<Map<String, Object>> searchPlaces(String query, int count) {
        if (query == null || query.trim().length() < 2) {
            return List.of();
        }
        URI uri = UriComponentsBuilder
                .fromUriString("https://geocoding-api.open-meteo.com/v1/search")
                .queryParam("name", query.trim())
                .queryParam("count", count)
                .queryParam("language", "en")
                .queryParam("format", "json")
                .build().encode().toUri();

        JsonNode response = restClient.get().uri(uri).retrieve().body(JsonNode.class);
        JsonNode results = response == null ? null : response.path("results");
        List<Map<String, Object>> places = new ArrayList<>();
        if (results == null || !results.isArray()) {
            return places;
        }
        for (JsonNode place : results) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", place.path("name").asText(""));
            item.put("admin1", place.path("admin1").asText(""));
            item.put("country", place.path("country").asText(""));
            item.put("latitude", place.path("latitude").asDouble());
            item.put("longitude", place.path("longitude").asDouble());
            places.add(item);
        }
        return places;
    }

    public Map<String, Object> getWeatherByCity(String city) {
        if (city == null || city.isBlank()) {
            throw new IllegalArgumentException("Please enter a city name.");
        }
        List<Map<String, Object>> places = searchPlaces(city, 1);
        if (places.isEmpty()) {
            throw new IllegalArgumentException("City not found. Please check the spelling.");
        }
        Map<String, Object> p = places.get(0);
        return getWeather(
                (String) p.get("name"), (String) p.get("admin1"), (String) p.get("country"),
                (double) p.get("latitude"), (double) p.get("longitude"));
    }

    public Map<String, Object> getWeather(String name, String admin1, String country,
                                          double latitude, double longitude) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("Invalid location.");
        }
        JsonNode forecast = loadForecast(latitude, longitude);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("city", name == null || name.isBlank() ? "Your location" : name);
        response.put("admin1", admin1 == null ? "" : admin1);
        response.put("country", country == null ? "" : country);
        response.put("timezone", forecast.path("timezone").asText(""));
        response.put("latitude", latitude);
        response.put("longitude", longitude);
        response.put("current", forecast.path("current"));
        response.put("hourly", forecast.path("hourly"));
        response.put("daily", forecast.path("daily"));
        return response;
    }

    private JsonNode loadForecast(double latitude, double longitude) {
        String key = String.format(Locale.ROOT, "%.2f,%.2f", latitude, longitude);
        CacheEntry cached = cache.get(key);
        if (cached != null && Duration.between(cached.createdAt(), Instant.now()).compareTo(CACHE_TTL) < 0) {
            return cached.forecast();
        }

        URI uri = UriComponentsBuilder
                .fromUriString("https://api.open-meteo.com/v1/forecast")
                .queryParam("latitude", latitude)
                .queryParam("longitude", longitude)
                .queryParam("current",
                        "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,"
                                + "precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure")
                .queryParam("hourly", "temperature_2m,precipitation_probability,weather_code,is_day")
                .queryParam("daily",
                        "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,"
                                + "uv_index_max,precipitation_probability_max")
                .queryParam("forecast_days", 5)
                .queryParam("timezone", "auto")
                .build().encode().toUri();

        JsonNode forecast = restClient.get().uri(uri).retrieve().body(JsonNode.class);
        if (forecast == null || forecast.path("current").isMissingNode()) {
            throw new IllegalStateException("Weather data could not be loaded.");
        }
        if (cache.size() > CACHE_MAX) {
            cache.clear();
        }
        cache.put(key, new CacheEntry(Instant.now(), forecast));
        return forecast;
    }
}
