# Website live karne aur Google pe lane ke steps

1. Domain kharidein (GoDaddy / Namecheap / Hostinger), e.g. skycast-india.in
2. Render.com par deploy karein (Dockerfile ready hai). Env var: APP_BASE_URL=https://yourdomain
3. Domain ko Render se connect karein (DNS CNAME/A record). HTTPS automatic milta hai.
4. Google Search Console (search.google.com/search-console) -> "Add property" -> domain verify karein.
5. Sitemaps section me daalein: https://yourdomain/sitemap.xml
6. "URL Inspection" me homepage daal ke "Request indexing" dabayein.
7. Bing Webmaster Tools par bhi same karein (sitemap import).
8. Indexing me kuch din se kuch hafte lagte hain. Naye domain par top ranking turant nahi milti.

Note: Render free plan 15 min idle ke baad sleep ho jata hai (pehla load slow). Google crawl ke liye paid plan (~$7/month) behtar hai.
Note: Open-Meteo ka free API sirf non-commercial use ke liye hai. Ads (AdSense) lagane ho to unka commercial plan lena padega.
