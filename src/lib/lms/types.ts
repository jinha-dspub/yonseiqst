export type ComponentType = 'html' | 'video' | 'quiz';

export interface BaseEntity {
    id: string;
    title: string;
}

/**
 * XBlock / Component: The smallest unit of content (Video, HTML, Quiz Problem)
 */
export interface UnitComponent extends BaseEntity {
    type: ComponentType;
    content: string; // Markdown text, Video URL, or Quiz JSON string

    // Open edX Advanced Quiz Properties (Optional)
    weight?: number;      // Maximum grade/points
    attempts?: number;    // Max attempts (0 = unlimited)
    showAnswer?: 'always' | 'never' | 'answered' | 'attempted';
}

/**
 * Unit (Page): A single webpage/view containing a vertical stack of Components.
 */
export interface Unit extends BaseEntity {
    components: UnitComponent[];
    status: 'draft' | 'published';
}

/**
 * Subsection (Lesson): A collection of Units representing a single learning topic.
 */
export interface Subsection extends BaseEntity {
    units: Unit[];
    status: 'draft' | 'published';
}

/**
 * Section (Chapter/Week): A large collection of Subsections.
 */
export interface Section extends BaseEntity {
    subsections: Subsection[];
    status: 'draft' | 'published';
}

/**
 * Course: The top-level learning module containing Sections.
 */
export interface Course extends BaseEntity {
    description: string;
    sections: Section[];
    status: 'draft' | 'published';
    imageUrl?: string;

    // Open edX Identification Metadata
    organization?: string;
    courseNumber?: string;
    courseRun?: string;
}
