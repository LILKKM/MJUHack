package com.example.hack.course;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.hack.course.CourseDtos.CourseRequest;
import com.example.hack.course.CourseDtos.CourseResponse;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courses;

    public CourseController(CourseService courses) {
        this.courses = courses;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseResponse create(@RequestBody CourseRequest request) {
        return courses.create(request);
    }

    @GetMapping("/{courseId}")
    public CourseResponse get(@PathVariable long courseId) {
        return courses.get(courseId);
    }
}
