import type { Course } from './course'

type CourseCardProps = {
    course: Course
}

export default function CourseCard({ course }: CourseCardProps) {
    return (
        <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex h-40 flex-col items-center justify-center gap-3 bg-slate-800 px-6 text-center">
                <p className="text-xs font-semibold text-slate-300">
                    IELTS LEARNING SERIES
                </p>

                <p className="text-base font-semibold uppercase text-white">
                    {course.category ?? 'IELTS PREPARATION'}
                </p>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex flex-wrap gap-2">
                    {course.category !== null && (
                        <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            {course.category}
                        </span>
                    )}

                    <span
                        className={
                            'rounded-lg px-2 py-1 text-xs font-semibold ' +
                            (course.enrollmentOpen
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600')
                        }
                    >
                        {course.enrollmentOpen ? 'Enrollment open' : 'Enrollment closed'}
                    </span>
                </div>

                <h2 className="text-xl font-bold leading-snug">
                    {course.title}
                </h2>

                <p className="text-sm leading-6 text-slate-600">
                    {course.description}
                </p>

                <p className="text-xs text-slate-500">
                    By {course.instructorName}
                </p>

                {course.learningItemCount !== undefined && (
                    <p className="text-xs text-slate-500">
                        {course.learningItemCount}{' '}
                        {course.learningItemCount === 1 ? 'learning item' : 'learning items'}
                    </p>
                )}

                <div className="mt-auto pt-4">
                    <button
                        type="button"
                        disabled
                        title="Course details will be connected in the next step"
                        className="w-full cursor-not-allowed rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                        View Course
                    </button>
                </div>
            </div>
        </article>
    )
}