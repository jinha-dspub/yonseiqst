import { Course } from "./types";

export function getMockCourse(): Course {
    return {
        id: "Yonsei+EH101+2026_T1",
        title: "직업환경보건 집중과정",
        organization: "Yonsei",
        courseNumber: "EH101",
        courseRun: "2026_T1",
        description: "산업보건의 기초부터 심화까지 다루는 핵심 강의입니다. Open edX 구조로 설계되었습니다.",
        status: "published",
        imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        sections: [
            {
                id: "sec-1",
                title: "1주차: 기초 역학",
                status: "published",
                subsections: [
                    {
                        id: "subsec-1-1",
                        title: "1.1 역학의 정의",
                        status: "published",
                        units: [
                            {
                                id: "unit-1-1-1",
                                title: "역학의 역사와 기본 개념",
                                status: "published",
                                components: [
                                    {
                                        id: "comp-html-1",
                                        title: "도입부 텍스트",
                                        type: "html",
                                        content: "# 역학(Epidemiology)이란 무엇인가?\n역학은 인구 집단에서 질병의 분포와 그 원인을 연구하는 학문입니다."
                                    },
                                    {
                                        id: "comp-vid-1",
                                        title: "1주차 오리엔테이션 영상",
                                        type: "video",
                                        content: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                                    },
                                    {
                                        id: "comp-quiz-1",
                                        title: "기초 이해도 점검",
                                        type: "quiz",
                                        content: "역학의 주요 연구 대상은 개인이 아닌 '인구 집단'이다. (O/X)",
                                        weight: 5.0,
                                        attempts: 2,
                                        showAnswer: "answered"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };
}
