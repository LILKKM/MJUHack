package com.example.hack.reference;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.hack.reference.ReferenceDtos.EraResponse;
import com.example.hack.reference.ReferenceDtos.KContentResponse;
import com.example.hack.reference.ReferenceDtos.UserTypeResponse;

@RestController
@RequestMapping("/api")
public class ReferenceController {

    private final ReferenceRepository repository;

    public ReferenceController(ReferenceRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/eras")
    public List<EraResponse> eras() {
        return repository.findEras();
    }

    @GetMapping("/k-contents")
    public List<KContentResponse> kContents() {
        return repository.findKContents();
    }

    @GetMapping("/user-types")
    public List<UserTypeResponse> userTypes() {
        return repository.findUserTypes();
    }
}
