const mangayomiSources = [{
    "name": "Anymex Special #2",
    "lang": "All",
    "baseUrl": "https://moviebox.ng/",
    "apiUrl": "",
    "iconUrl": "https://raw.githubusercontent.com/RyanYuuki/AnymeX/main/assets/images/logo.png",
    "typeSource": "multi",
    "itemType": 1,
    "version": "0.0.3",
    "pkgPath": "anime/src/all/anymex_special_2.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getHeaders(url) {
        throw new Error("getHeaders not implemented");
    }

    mapToManga(dataArr, isMovie) {
        var type = isMovie ? "movie" : "tv";
        return dataArr.map((e) => {
            return {
                name: e.title ?? e.name,
                link: `https://tmdb.hexa.watch/api/tmdb/${type}/${e.id}`,
                imageUrl:
                    "https://image.tmdb.org/t/p/w500" +
                    (e.poster_path ?? e.backdrop_path),
                description: e.overview,
            };
        });
    }

    async requestSearch(query, isMovie) {
        const type = isMovie ? "movie" : "tv";
        const url = `https://tmdb.hexa.watch/api/tmdb/search/${type}?language=en-US&query=${encodeURIComponent(
            query
        )}&page=1&include_adult=false`;

        // Log headers for debugging
        const headers = { 
            Referer: "https://moviebox.ng/", 
            Origin: "https://moviebox.ng",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Node.js/18.16.0"
        };
        console.log("[requestSearch] URL:", url);
        console.log("[requestSearch] Headers:", headers);

        const resp = await this.client.get(url, headers);
        const data = JSON.parse(resp.body);
        return data;
    }

    async getPopular(page) {
        throw new Error("getPopular not implemented");
    }

    get supportsLatest() {
        throw new Error("supportsLatest not implemented");
    }

    async getLatestUpdates(page) {
        throw new Error("getLatestUpdates not implemented");
    }

    async search(query, page = 1, filters) {
        try {
            const cleanedQuery = query.replace(/\bseasons?\b/gi, "").trim();

            const [movieData, seriesData] = await Promise.all([
                this.requestSearch(cleanedQuery, true),
                this.requestSearch(cleanedQuery, false),
            ]);

            const movies = this.mapToManga(movieData.results || [], true);
            const series = this.mapToManga(seriesData.results || [], false);

            const maxLength = Math.max(movies.length, series.length);
            const mixedResults = [];

            for (let i = 0; i < maxLength; i++) {
                if (i < series.length) mixedResults.push(series[i]);
                if (i < movies.length) mixedResults.push(movies[i]);

            }

            return {
                list: mixedResults,
                hasNextPage: false,
            };
        } catch (error) {
            console.error("Search error:", error);
            throw error;
        }
    }

    async getDetail(url) {
        // Log headers for debugging
        const headers = { 
            Referer: "https://moviebox.ng/", 
            Origin: "https://moviebox.ng",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Node.js/18.16.0"
        };
        console.log("[getDetail] URL:", url);
        console.log("[getDetail] Headers:", headers);

        const resp = await this.client.get(url, headers);
        const parsedData = JSON.parse(resp.body);
        const isMovie = url.includes("movie");

        const name = parsedData.name ?? parsedData.title;
        const chapters = [];

        const idMatch = url.match(/(?:movie|tv)\/(\d+)/);
        const tmdbId = idMatch ? idMatch[1] : null;

        if (!tmdbId) throw new Error("Invalid TMDB ID in URL");

        if (isMovie) {
            chapters.push({
                name: "Movie",
                url: `https://oc.autoembed.cc/movie/${tmdbId}`,
            });
        } else {
            const seasons = parsedData.seasons || [];

            for (const season of seasons) {
                if (season.season_number === 0) continue;

                const episodeCount = season.episode_count;

                for (let ep = 1; ep <= episodeCount; ep++) {
                    chapters.push({
                        name: `S${season.season_number} · E${ep}`,
                        url: `https://oc.autoembed.cc/tv/${tmdbId}/${season.season_number}/${ep}`,
                    });
                }
            }
        }

        return {
            name,
            chapters: chapters.reverse(),
        };
    }

    // For novel html content
    async getHtmlContent(url) {
        throw new Error("getHtmlContent not implemented");
    }

    // Clean html up for reader
    async cleanHtmlContent(html) {
        throw new Error("cleanHtmlContent not implemented");
    }

    async getVideoList(url) {
        const headers = { 
            Referer: "https://moviebox.ng/", 
            Origin: "https://moviebox.ng",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Node.js/18.16.0"
        };
        console.log("[getVideoList] URL:", url);
        console.log("[getVideoList] Headers:", headers);

        // Helper to parse the response
        const parseResponse = (response, langLabel) => {
            try {
                const data = JSON.parse(response.body);
                console.log(`Fetched ${langLabel} Data =>`, data);

                if (data?.streams) {
                    return data.streams.map((stream) => ({
                        url: stream.stream_url,
                        quality: stream.quality,
                        originalUrl: stream.stream_url,
                        subtitles: [],
                        headers: {
                            Referer: "https://moviebox.ng/",
                            Origin: "https://moviebox.ng",
                        },
                    }));
                }

                if (data?.data?.downloads) {
                    return data.data.downloads.map((stream) => ({
                        url: stream.url,
                        quality: `${langLabel} - ${stream.resolution}`,
                        originalUrl: stream.url,
                        subtitles: (data.data.captions || []).map((sub) => ({
                            file: sub.url,
                            label: sub.lanName,
                        })),
                        headers: {
                            Referer: "https://moviebox.ng/",
                            Origin: "https://moviebox.ng",
                        },
                    }));
                }

                return [];
            } catch (err) {
                console.warn(`Failed to parse ${langLabel} response:`, err);
                return [];
            }
        };

        // Try original URL first
        const [engResponse, hindiResponse] = await Promise.all([
            this.client.get(url, headers),
            this.client.get(`${url}?lang=Hindi`, headers),
        ]);
        let engResults = parseResponse(engResponse, "English");
        let hindiResults = parseResponse(hindiResponse, "Hindi");
        let areSame = JSON.stringify(engResults) === JSON.stringify(hindiResults);
        let combined = areSame ? engResults : [...engResults, ...hindiResults];

        // If no results, try fallback to season 1 (if not already season 1)
        if (combined.length === 0) {
            // Try to replace /tv/{id}/{season}/ with /tv/{id}/1/
            const fallbackUrl = url.replace(/(\/tv\/\d+\/)(\d+)(\/\d+)/, (m, p1, p2, p3) => `${p1}1${p3}`);
            if (fallbackUrl !== url) {
                console.log("[getVideoList] Fallback to season 1 URL:", fallbackUrl);
                const [engFallback, hindiFallback] = await Promise.all([
                    this.client.get(fallbackUrl, headers),
                    this.client.get(`${fallbackUrl}?lang=Hindi`, headers),
                ]);
                engResults = parseResponse(engFallback, "English (S1 fallback)");
                hindiResults = parseResponse(hindiFallback, "Hindi (S1 fallback)");
                areSame = JSON.stringify(engResults) === JSON.stringify(hindiResults);
                combined = areSame ? engResults : [...engResults, ...hindiResults];
            }
        }

        return combined;
    }



    // For manga chapter pages
    async getPageList(url) {
        throw new Error("getPageList not implemented");
    }

    getFilterList() {
        throw new Error("getFilterList not implemented");
    }

    getSourcePreferences() {
        throw new Error("getSourcePreferences not implemented");
    }
}
