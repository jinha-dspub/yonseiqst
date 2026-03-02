export type ComponentType = 'html' | 'video' | 'quiz' | 'document' | 'embed';

export interface BaseEntity {
    id: string;
    title: string;
    publishDate?: string; // ISO 8601 UTC date string, representing scheduled publish time (usually KST)
}

/**
 * XBlock / Component: The smallest unit of content (Video, HTML, Quiz Problem)
 */
export interface UnitComponent extends BaseEntity {
    type: ComponentType;
    content: string; // Markdown text, Video URL, or Quiz JSON string
    description?: string; // Optional subtitle or context for why a document should be downloaded
    displayMode?: 'link' | 'iframe'; // How to display document types 

    // Video-specific properties
    videoId?: string;         // edX-assigned video ID
    fallbackUrls?: string[];  // Alternative video URLs (.mp4, .webm) for compatibility
    thumbnailUrl?: string;    // Custom thumbnail image URL
    allowDownload?: boolean;  // Whether students can download the video

    // Open edX Advanced Quiz Properties (Optional)
    weight?: number;      // Maximum grade/points
    attempts?: number;    // Max attempts (0 = unlimited)
    showAnswer?: 'always' | 'never' | 'answered' | 'attempted';

    // Quiz Bank Integration
    quizBankId?: string;          // Reference to question_banks.id
    quizMode?: 'all' | 'random' | 'select';  // How to pick questions from the bank
    questionCount?: number;       // Number of random questions to pick
    selectedQuestionIds?: string[]; // Specific question IDs for 'select' mode
    reshuffleOnRetry?: boolean;   // Whether to pick new random questions on each attempt

    // Quiz Grading
    isGraded?: boolean;           // Whether this quiz counts for grading
    passingScore?: number;        // Minimum score (percentage, 0-100) to pass
}

/**
 * Unit (Page): A single webpage/view containing a vertical stack of Components.
 */
export interface Unit extends BaseEntity {
    components: UnitComponent[];
    status: 'draft' | 'published' | 'scheduled' | 'none'; // Added new statuses
}

/**
 * Subsection (Lesson): A collection of Units representing a single learning topic.
 */
export interface Subsection extends BaseEntity {
    units: Unit[];
    status: 'draft' | 'published' | 'scheduled' | 'none'; // Added new statuses
}

/**
 * Section (Chapter/Week): A large collection of Subsections.
 */
export interface Section extends BaseEntity {
    subsections: Subsection[];
    status: 'draft' | 'published' | 'scheduled' | 'none'; // Added new statuses
}

/**
 * Course: The top-level learning module containing Sections.
 */
export interface Course extends BaseEntity {
    description: string;
    sections: Section[];
    status: 'draft' | 'published' | 'none';
    thumbnail?: string;
    visibility?: 'public' | 'cohort' | 'none'; // Added 'none'
    allowedCohorts?: string[]; // Array of cohort names

    // Open edX Identification Metadata
    organization?: string;
    courseNumber?: string;
    courseRun?: string;
}

// --- Advanced Quiz Data Structures ---

export type QuizProblemType = 'multiple_choice' | 'short_answer' | 'descriptive' | 'assignment';

export interface BaseQuizProblem {
    id: string;
    type: QuizProblemType;
    question: string;
    imageUrl?: string;  // Optional image for the question
    points: number;
    explanation?: string;
}

export interface MultipleChoiceProblem extends BaseQuizProblem {
    type: 'multiple_choice';
    options: (string | { text: string; imageUrl?: string })[];
    answer: number; // index of the correct option
}

export interface ShortAnswerProblem extends BaseQuizProblem {
    type: 'short_answer';
    acceptable_answers: string[];
}

export interface DescriptiveProblem extends BaseQuizProblem {
    type: 'descriptive';
    min_length?: number;
    keywords?: string[];
}

export interface AssignmentProblem extends BaseQuizProblem {
    type: 'assignment';
    allowedFileTypes?: string[];  // e.g. ['pdf', 'jpg', 'png', 'docx']
    maxFileSize?: number;         // in MB, default 10
    requireText?: boolean;        // whether text response is also required
    min_length?: number;          // min text length if requireText
}

export type QuizProblem = MultipleChoiceProblem | ShortAnswerProblem | DescriptiveProblem | AssignmentProblem;
