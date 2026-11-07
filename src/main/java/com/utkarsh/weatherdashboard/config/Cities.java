package com.utkarsh.weatherdashboard.config;

import java.util.List;

/** Popular cities used for internal links and the sitemap (helps Google discover city pages). */
public final class Cities {
    private Cities() {}

    public static final List<String> POPULAR = List.of(
            "Lucknow", "Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru", "Hyderabad",
            "Pune", "Ahmedabad", "Jaipur", "Kanpur", "Varanasi", "Patna", "Bhopal",
            "Chandigarh", "Indore", "Surat", "Nagpur", "Prayagraj", "Agra", "Gorakhpur",
            "Dehradun", "Noida", "Ranchi", "Goa",
            "London", "New York", "Dubai", "Singapore", "Tokyo");

    public static String slug(String city) {
        return city.toLowerCase().trim().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }
}
