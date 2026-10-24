import type { Course } from './course'

type CourseCardProps = {
    course: Course
}

export default function CourseCard({ course }: CourseCardProps) {
    const showProgress = course.enrolled && course.progress !== null

    return (
        <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex h-40 flex-col items-center justify-center gap-3 bg-slate-800 px-6 text-center">
                <p className="text-xs font-semibold text-slate-300">
                    IELTS LEARNING SERIES
                </p>

                <p className="text-base font-semibold uppercase text-white">
                    {course.category}
                </p>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                        {course.category}
                    </span>

                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        {course.enrolled ? 'Enrolled' : 'Open'}
                    </span>
                </div>

                <h2 className="text-xl font-bold leading-snug">
                    {course.title}
                </h2>

                <p className="text-sm leading-6 text-slate-600">
                    {course.description}
                </p>

                <p className="text-xs text-slate-500">
                    By Instructor {course.instructorName} · {course.lessonCount} lessons
                </p>

                <div className="mt-auto pt-2">
                    {showProgress && (
                        <div className="mb-4">
                            <p className="mb-2 text-xs text-slate-600">
                                Content completed: {course.progress}%
                            </p>

                            <progress
                                value={course.progress ?? 0}
                                max={100}
                                aria-label={`${course.title}: content completed`}
                                className="block h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600"
                            />
                        </div>
                    )}

                    <button
                        type="button"
                        disabled
                        title="Course navigation will be connected in the next step"
                        className={
                            'w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed ' +
                            (course.enrolled
                                ? 'bg-blue-600 text-white'
                                : 'border border-slate-300 bg-white text-slate-700')
                        }
                    >
                        {course.enrolled
                            ? 'Continue Learning →'
                            : 'View Course & Enroll'}
                    </button>
                </div>
            </div>
        </article>
    )
}