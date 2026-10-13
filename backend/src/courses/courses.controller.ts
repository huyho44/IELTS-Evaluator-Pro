
import { Controller, Get, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { CoursesService } from './courses.service.js';

@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesServices: CoursesService){}

    /**
     * Endpoint: GET /Courses
     */
    @Get()
    async getAllCourses(){
        return this.coursesServices.findAll();
    }

    /**
     * Endpoint: GET /Courses/:id
     */

    @Get(':id')
    async getCoursesId(@Param('id', ParseIntPipe) id: number){
        return this.coursesServices.findOne(id);
    }

    /**
     * Endpoint: POST /Courses/:id/enroll
     */

    @Post(':id/enroll')
    async enroll(
        @Param('id', ParseIntPipe) courseId: number,
        @Body('userId',ParseIntPipe) userId: number,
    ){
        return this.coursesServices.enrollCourse(courseId,userId);
    }
}