/**
 * Supabase-backed course storage service.
 * Replaces localStorage for CMS/LMS sync across users.
 */
import { createClient } from "@/lib/supabaseClient";
import type { Course } from "@/lib/lms/types";

const TABLE = "courses";

/** Load all courses from Supabase */
export async function getCourses(): Promise<Course[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: false });
    if (error) {
        console.error("[courseService] getCourses error:", error.message, error.details);
        return [];
    }
    if (!data) return [];
    return data.map(rowToCourse);
}

/** Load a single course by ID */
export async function getCourseById(id: string): Promise<Course | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) {
        console.error(`[courseService] getCourseById error for ${id}:`, error.message);
        return null;
    }
    if (!data) return null;
    return rowToCourse(data);
}

/** Save (upsert) a course to Supabase */
export async function saveCourseToDb(course: Course): Promise<boolean> {
    const supabase = createClient();
    const row = courseToRow(course);
    const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "id" });
    if (error) {
        console.error("[courseService] saveCourse error:", error.message, error.details);
        // Throw or return false - here we return false as specified in the original signature
        return false;
    }
    return true;
}

/** Delete a course from Supabase */
export async function deleteCourseFromDb(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
        console.error("[courseService] deleteCourse error:", error.message);
        return false;
    }
    return true;
}

// ------ Mapping helpers ------

function rowToCourse(row: any): Course {
    const content = row.content || {};
    return {
        id: row.id,
        title: row.title,
        organization: row.organization,
        courseNumber: row.course_number,
        courseRun: row.course_run,
        description: row.description,
        thumbnail: row.thumbnail,
        status: row.status,
        visibility: row.visibility,
        allowedCohorts: row.allowed_cohorts || [],
        publishDate: row.publish_date,
        // sections etc. are stored in the content JSONB blob
        ...content,
        sections: content.sections || [],
    } as Course;
}

function courseToRow(course: Course) {
    const { id, title, organization, courseNumber, courseRun, description, thumbnail, status, visibility, allowedCohorts, publishDate, sections, ...rest } = course;
    return {
        id,
        title,
        organization: organization || null,
        course_number: courseNumber || null,
        course_run: courseRun || null,
        description: description || null,
        thumbnail: thumbnail || null,
        status: status || "draft",
        visibility: visibility || "public",
        allowed_cohorts: allowedCohorts || [],
        publish_date: publishDate || null,
        content: { ...rest, sections: sections || [] }, // stores sections, etc.
        updated_at: new Date().toISOString(),
    };
}
