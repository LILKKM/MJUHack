package com.example.hack.spot;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.hack.common.ApiException;
import com.example.hack.reference.ReferenceRepository;
import com.example.hack.spot.SpotDtos.Article;
import com.example.hack.spot.SpotDtos.CrossLinkResponse;
import com.example.hack.spot.SpotDtos.SpotDetail;
import com.example.hack.spot.SpotDtos.SpotSummary;

@RestController
@RequestMapping("/api")
public class SpotController {

    private final SpotRepository spots;
    private final ReferenceRepository reference;

    public SpotController(SpotRepository spots, ReferenceRepository reference) {
        this.spots = spots;
        this.reference = reference;
    }

    @GetMapping("/spots")
    public List<SpotSummary> list(
            @RequestParam(required = false) String eraId,
            @RequestParam(required = false) Long kContentId,
            @RequestParam(required = false) String districtId,
            @RequestParam(defaultValue = "false") boolean hasCoords) {
        List<String> eraIds = null;
        if (eraId != null) {
            if (!reference.eraExists(eraId)) {
                throw ApiException.badRequest("알 수 없는 eraId: " + eraId);
            }
            eraIds = List.of(eraId);
        } else if (kContentId != null) {
            eraIds = reference.findEraIdsOfKContent(kContentId)
                    .orElseThrow(() -> ApiException.badRequest("알 수 없는 kContentId: " + kContentId));
        }
        return spots.search(eraIds, districtId, hasCoords);
    }

    @GetMapping("/spots/{spotId}")
    public SpotDetail detail(@PathVariable String spotId) {
        return spots.findDetail(spotId)
                .orElseThrow(() -> ApiException.notFound("SPOT_NOT_FOUND", "장소를 찾을 수 없습니다: " + spotId));
    }

    @GetMapping("/spots/{spotId}/articles")
    public List<Article> articles(@PathVariable String spotId, @RequestParam(defaultValue = "ko") String language) {
        if (!spots.exists(spotId)) {
            throw ApiException.notFound("SPOT_NOT_FOUND", "장소를 찾을 수 없습니다: " + spotId);
        }
        return spots.findPublishedArticles(spotId, language);
    }

    @GetMapping("/cross-links")
    public List<CrossLinkResponse> crossLinks(@RequestParam(required = false) String spotId) {
        return spots.findCrossLinks(spotId);
    }

    @GetMapping("/cross-links/{crossLinkId}")
    public CrossLinkResponse crossLink(@PathVariable String crossLinkId) {
        return spots.findCrossLink(crossLinkId)
                .orElseThrow(() -> ApiException.notFound("CROSS_LINK_NOT_FOUND", "연결을 찾을 수 없습니다: " + crossLinkId));
    }
}
