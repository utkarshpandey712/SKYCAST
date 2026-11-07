package com.utkarsh.weatherdashboard.controller;

import com.utkarsh.weatherdashboard.service.WeatherService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class WeatherController {
    private final WeatherService weatherService;

    public WeatherController(WeatherService weatherService) {
        this.weatherService = weatherService;
    }

    /** Weather by city name (?city=Lucknow) or by coordinates (?lat=..&lon=..&name=..). */
    @GetMapping("/weather")
    public Map<String, Object> getWeather(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String admin1,
            @RequestParam(required = false) String country) {
        try {
            if (lat != null && lon != null) {
                return weatherService.getWeather(name, admin1, country, lat, lon);
            }
            if (city == null || city.isBlank()) {
                throw new IllegalArgumentException("Please enter a city name.");
            }
            return weatherService.getWeatherByCity(city.trim());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Weather service is temporarily unavailable. Please try again.");
        }
    }

    /** Autocomplete suggestions for the search box. */
    @GetMapping("/search")
    public List<Map<String, Object>> search(@RequestParam("q") String query) {
        try {
            return weatherService.searchPlaces(query, 6);
        } catch (Exception ex) {
            return List.of();
        }
    }
}
